package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final com.iuhconnect.chatservice.repository.ConversationRepository conversationRepository;

    public List<MessageEntity> getHistory(String conversationId, Long before, int limit) {
        Pageable pageable = PageRequest.of(0, limit);
        if (before != null && before > 0) {
            return messageRepository.findByConversationIdAndTimestampLessThanOrderByTimestampDesc(conversationId, before, pageable);
        } else {
            return messageRepository.findByConversationIdOrderByTimestampDesc(conversationId, pageable);
        }
    }

    public List<com.iuhconnect.chatservice.dto.ConversationSummaryDto> getRecentConversations(String username) {
        List<String> groupIds = conversationRepository.findByMembersUserId(username)
                .stream().map(com.iuhconnect.chatservice.model.ConversationEntity::getId).toList();
        return messageRepository.findRecentConversationsForUser(username, groupIds);
    }

    public void markAsRead(String conversationId, String userId) {
        List<MessageEntity> unreadMessages = messageRepository.findByConversationIdOrderByTimestampDesc(conversationId, Pageable.unpaged())
                .stream()
                .filter(msg -> !msg.isRead() && userId.equals(msg.getReceiverId()))
                .toList();
        
        for (MessageEntity msg : unreadMessages) {
            msg.setRead(true);
        }
        messageRepository.saveAll(unreadMessages);
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
