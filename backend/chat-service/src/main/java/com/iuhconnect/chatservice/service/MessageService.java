package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;

    public List<MessageEntity> getHistory(String conversationId) {
        return messageRepository.findByConversationIdOrderByTimestampDesc(conversationId);
    }

    public List<MessageEntity> getRecentConversations(String username) {
        return messageRepository.findRecentConversationsForUser(username);
    }
}
