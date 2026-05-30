package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.dto.ConversationSummaryDto;
import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import com.iuhconnect.chatservice.exception.AppException;
import com.iuhconnect.chatservice.exception.ErrorCode;
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
    private final RealtimeEventService realtimeEventService;

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
                .orElseThrow(() -> new AppException(ErrorCode.MESSAGE_NOT_FOUND));

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

    public MessageEntity togglePinMessage(String messageId, String userId, String conversationId) {
        MessageEntity msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found: " + messageId));

        if (!msg.getConversationId().equals(conversationId)) {
            throw new RuntimeException("Message does not belong to this conversation");
        }

        // Try to find conversation (only GROUP chats have a ConversationEntity)
        java.util.Optional<com.iuhconnect.chatservice.model.ConversationEntity> optConversation =
                conversationRepository.findById(conversationId);

        // For GROUP chats: only ADMIN or DEPUTY can pin
        if (optConversation.isPresent() && 
            optConversation.get().getType() == com.iuhconnect.chatservice.model.ConversationType.GROUP) {
            boolean hasPrivilege = optConversation.get().getMembers().stream()
                    .anyMatch(m -> m.getUserId().equals(userId) &&
                            (m.getRole() == com.iuhconnect.chatservice.model.GroupRole.ADMIN ||
                             m.getRole() == com.iuhconnect.chatservice.model.GroupRole.DEPUTY));
            if (!hasPrivilege) {
                throw new RuntimeException("Only ADMIN or DEPUTY can pin/unpin messages");
            }
        }
        // For SINGLE chats (no conversation entity): any participant can pin

        // Toggle pin
        boolean newPinState = !msg.isPinned();
        msg.setPinned(newPinState);
        if (newPinState) {
            msg.setPinnedBy(userId);
            msg.setPinnedAt(System.currentTimeMillis());
        } else {
            msg.setPinnedBy(null);
            msg.setPinnedAt(0);
        }

        MessageEntity saved = messageRepository.save(msg);

        // Broadcast PIN_MESSAGE event
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("type", "PIN_MESSAGE");
        payload.put("conversationId", conversationId);
        payload.put("messageId", saved.getId());
        payload.put("pinned", saved.isPinned());
        payload.put("pinnedBy", saved.getPinnedBy());
        payload.put("content", saved.getContent());
        payload.put("senderId", saved.getSenderId());
        payload.put("messageType", saved.getMessageType());

        if (optConversation.isPresent() && 
            optConversation.get().getType() == com.iuhconnect.chatservice.model.ConversationType.GROUP) {
            for (com.iuhconnect.chatservice.model.GroupMember member : optConversation.get().getMembers()) {
                realtimeEventService.sendToUser(member.getUserId(), payload);
            }
        } else {
            // SINGLE chat: notify both sender and receiver
            realtimeEventService.sendToUser(saved.getSenderId(), payload);
            if (saved.getReceiverId() != null && !saved.getReceiverId().equals(saved.getSenderId())) {
                realtimeEventService.sendToUser(saved.getReceiverId(), payload);
            }
        }

        log.info("📌 Message [{}] {} by [{}] in conversation [{}]",
                messageId, newPinState ? "PINNED" : "UNPINNED", userId, conversationId);

        return saved;
    }

    public java.util.List<MessageEntity> getPinnedMessages(String conversationId) {
        return messageRepository.findByConversationIdAndPinnedTrue(conversationId);
    }
}
