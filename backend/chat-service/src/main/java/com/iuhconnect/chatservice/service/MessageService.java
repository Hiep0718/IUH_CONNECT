package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.dto.ConversationSummaryDto;
import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@Service
@RequiredArgsConstructor
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);

    private final MessageRepository messageRepository;
    private final com.iuhconnect.chatservice.repository.ConversationRepository conversationRepository;
    private final org.springframework.data.mongodb.core.MongoTemplate mongoTemplate;
    private final ConversationReadModelService conversationReadModelService;

    public List<MessageEntity> getHistory(String conversationId, Long before, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        if (before != null && before > 0) {
            return messageRepository.findByConversationIdAndTimestampLessThanOrderByTimestampDesc(conversationId, before, pageable);
        } else {
            return messageRepository.findByConversationIdOrderByTimestampDesc(conversationId, pageable);
        }
    }

    /**
     * CQRS Query: Đọc danh sách chat từ Redis (siêu nhanh).
     * Nếu Redis trống (lần đầu) → fallback về MongoDB aggregation → ghi kết quả vào Redis.
     */
    public List<ConversationSummaryDto> getRecentConversations(String username) {
        // Bước 1: Thử đọc từ Redis (CQRS Read Model)
        List<ConversationSummaryDto> fromRedis = conversationReadModelService.getRecentConversations(username);
        if (fromRedis != null && !fromRedis.isEmpty()) {
            log.info("⚡ CQRS: Loaded {} conversations from Redis for user [{}]", fromRedis.size(), username);
            return fromRedis;
        }

        // Bước 2: Fallback — Chạy aggregation pipeline từ MongoDB (chậm hơn)
        log.info("📦 CQRS Fallback: Reading from MongoDB for user [{}]", username);
        List<ConversationSummaryDto> fromMongo = getRecentConversationsFromMongo(username);

        // Bước 3: Rebuild Read Model vào Redis (để lần sau đọc nhanh)
        if (!fromMongo.isEmpty()) {
            conversationReadModelService.rebuildReadModel(username, fromMongo);
        }

        return fromMongo;
    }

    /**
     * Aggregation pipeline gốc từ MongoDB (giữ lại làm fallback).
     */
    private List<ConversationSummaryDto> getRecentConversationsFromMongo(String username) {
        List<String> groupIds = conversationRepository.findByMembersUserId(username)
                .stream().map(com.iuhconnect.chatservice.model.ConversationEntity::getId).toList();

        org.springframework.data.mongodb.core.aggregation.Aggregation aggregation = org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation(
                org.springframework.data.mongodb.core.aggregation.Aggregation.match(
                        new org.springframework.data.mongodb.core.query.Criteria().orOperator(
                                org.springframework.data.mongodb.core.query.Criteria.where("sender_id").is(username),
                                org.springframework.data.mongodb.core.query.Criteria.where("receiver_id").is(username),
                                org.springframework.data.mongodb.core.query.Criteria.where("conversation_id").in(groupIds)
                        )
                ),
                org.springframework.data.mongodb.core.aggregation.Aggregation.sort(org.springframework.data.domain.Sort.Direction.DESC, "timestamp"),
                new org.springframework.data.mongodb.core.aggregation.AggregationOperation() {
                    @Override
                    public org.bson.Document toDocument(org.springframework.data.mongodb.core.aggregation.AggregationOperationContext context) {
                        return new org.bson.Document("$group",
                                new org.bson.Document("_id", "$conversation_id")
                                        .append("doc", new org.bson.Document("$first", "$$ROOT"))
                                        .append("unreadCount", new org.bson.Document("$sum",
                                                new org.bson.Document("$cond", java.util.Arrays.asList(
                                                        new org.bson.Document("$and", java.util.Arrays.asList(
                                                                new org.bson.Document("$ne", java.util.Arrays.asList("$sender_id", username)),
                                                                new org.bson.Document("$ne", java.util.Arrays.asList("$is_read", true))
                                                        )),
                                                        1, 0
                                                ))
                                        ))
                        );
                    }
                },
                new org.springframework.data.mongodb.core.aggregation.AggregationOperation() {
                    @Override
                    public org.bson.Document toDocument(org.springframework.data.mongodb.core.aggregation.AggregationOperationContext context) {
                        return new org.bson.Document("$addFields", new org.bson.Document("doc.unreadCount", "$unreadCount"));
                    }
                },
                new org.springframework.data.mongodb.core.aggregation.AggregationOperation() {
                    @Override
                    public org.bson.Document toDocument(org.springframework.data.mongodb.core.aggregation.AggregationOperationContext context) {
                        return new org.bson.Document("$unset", "doc._class");
                    }
                },
                org.springframework.data.mongodb.core.aggregation.Aggregation.replaceRoot("doc"),
                org.springframework.data.mongodb.core.aggregation.Aggregation.sort(org.springframework.data.domain.Sort.Direction.DESC, "timestamp")
        );

        return mongoTemplate.aggregate(aggregation, "messages", ConversationSummaryDto.class).getMappedResults();
    }

    public void markAsRead(String conversationId, String userId) {
        List<MessageEntity> unreadMessages = messageRepository.findByConversationIdOrderByTimestampDesc(conversationId, Pageable.unpaged())
                .stream()
                .filter(msg -> !msg.isRead() && !userId.equals(msg.getSenderId()))
                .toList();
        
        for (MessageEntity msg : unreadMessages) {
            msg.setRead(true);
        }
        messageRepository.saveAll(unreadMessages);

        // CQRS: Reset unreadCount trong Redis
        conversationReadModelService.resetUnreadCount(conversationId, userId);
    }

    public MessageEntity toggleReaction(String messageId, String userId, String emoji) {
        MessageEntity msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found: " + messageId));

        java.util.Map<String, java.util.List<String>> reactions = msg.getReactions();
        if (reactions == null) {
            reactions = new java.util.HashMap<>();
        }

        java.util.List<String> users = reactions.getOrDefault(emoji, new java.util.ArrayList<>());
        if (users.contains(userId)) {
            users.remove(userId);
            if (users.isEmpty()) {
                reactions.remove(emoji);
            }
        } else {
            users.add(userId);
            reactions.put(emoji, users);
        }
        msg.setReactions(reactions);
        return messageRepository.save(msg);
    }
}
