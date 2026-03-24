package com.iuhconnect.chatservice.consumer;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ChatMessageKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(ChatMessageKafkaConsumer.class);
    private static final String REDIS_CHANNEL = "chat-channel";

    private final MessageRepository messageRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public ChatMessageKafkaConsumer(MessageRepository messageRepository,
                                   StringRedisTemplate redisTemplate,
                                   ObjectMapper objectMapper) {
        this.messageRepository = messageRepository;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(
            topics = "chat-messages",
            groupId = "chat-service-group"
    )
    public void consumeChatMessage(ChatMessageDto message) {
        log.info("📩 Received chat message from Kafka [from={}, to={}, conv={}]",
                message.getSenderId(), message.getReceiverId(), message.getConversationId());

        try {
            // 1. Save message to MongoDB
            MessageEntity entity = MessageEntity.builder()
                    .senderId(message.getSenderId())
                    .receiverId(message.getReceiverId())
                    .content(message.getContent())
                    .conversationId(message.getConversationId())
                    .timestamp(message.getTimestamp())
                    .build();

            messageRepository.save(entity);
            log.info("💾 Message saved to MongoDB [id={}]", entity.getId());

            // 2. Publish to Redis Pub/Sub for multi-node broadcast
            String json = objectMapper.writeValueAsString(message);
            redisTemplate.convertAndSend(REDIS_CHANNEL, json);
            log.info("📡 Message published to Redis channel [{}]", REDIS_CHANNEL);

        } catch (JsonProcessingException e) {
            log.error("❌ Failed to serialize message for Redis: {}", e.getMessage(), e);
        } catch (Exception e) {
            log.error("❌ Failed to process chat message: {}", e.getMessage(), e);
        }
    }
}
