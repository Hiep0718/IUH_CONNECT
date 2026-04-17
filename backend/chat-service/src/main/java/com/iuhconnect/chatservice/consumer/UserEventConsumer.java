package com.iuhconnect.chatservice.consumer;

import com.iuhconnect.chatservice.dto.UserEventDto;
import com.iuhconnect.chatservice.model.ChatUser;
import com.iuhconnect.chatservice.repository.ChatUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class UserEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(UserEventConsumer.class);

    private final ChatUserRepository chatUserRepository;

    public UserEventConsumer(ChatUserRepository chatUserRepository) {
        this.chatUserRepository = chatUserRepository;
    }

    @KafkaListener(
            topics = "user-events",
            groupId = "chat-service-group",
            containerFactory = "kafkaListenerContainerFactory"
    )
    public void consumeUserEvent(org.springframework.messaging.Message<UserEventDto> message) {
        UserEventDto event = message.getPayload();
        
        if (event == null) {
            log.warn("⚠️ Received null user event, likely due to deserialization error. Skipping.");
            return;
        }

        log.info("📩 Received user event from Kafka [userId={}, username={}]",
                event.getUserId(), event.getUsername());

        try {
            // Upsert: update if exists, insert if new
            ChatUser chatUser = chatUserRepository.findByUserId(event.getUserId())
                    .map(existing -> {
                        existing.setUsername(event.getUsername());
                        existing.setAvatarUrl(event.getAvatarUrl());
                        log.info("🔄 Updating existing ChatUser [userId={}]", event.getUserId());
                        return existing;
                    })
                    .orElseGet(() -> {
                        log.info("➕ Creating new ChatUser [userId={}]", event.getUserId());
                        return ChatUser.builder()
                                .userId(event.getUserId())
                                .username(event.getUsername())
                                .avatarUrl(event.getAvatarUrl())
                                .build();
                    });

            chatUserRepository.save(chatUser);
            log.info("✅ ChatUser synced successfully [userId={}, username={}]",
                    chatUser.getUserId(), chatUser.getUsername());

        } catch (Exception e) {
            log.error("❌ Failed to sync ChatUser [userId={}]: {}",
                    event.getUserId(), e.getMessage(), e);
        }
    }
}
