package com.iuhconnect.notificationservice.consumer;

import com.iuhconnect.notificationservice.cache.LocalCacheService;
import com.iuhconnect.notificationservice.dto.UserEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class UserEventConsumer {
    private static final Logger log = LoggerFactory.getLogger(UserEventConsumer.class);
    private final LocalCacheService localCacheService;

    public UserEventConsumer(LocalCacheService localCacheService) {
        this.localCacheService = localCacheService;
    }

    @KafkaListener(topics = "user-events", groupId = "notification-service-user-group")
    public void consumeUserEvent(UserEventDto event) {
        if (event == null) return;

        if ("FCM_TOKEN_UPDATED".equals(event.getEventType())) {
            log.info("📩 Received FCM_TOKEN_UPDATED for user {} ({})", event.getUsername(), event.getUserId());
            localCacheService.setToken(event.getUsername(), event.getFcmToken());
        }
    }
}
