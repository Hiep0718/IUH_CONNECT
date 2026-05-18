package com.iuhconnect.notificationservice.consumer;

import com.iuhconnect.notificationservice.cache.LocalCacheService;
import com.iuhconnect.notificationservice.dto.PresenceEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class PresenceEventConsumer {
    private static final Logger log = LoggerFactory.getLogger(PresenceEventConsumer.class);
    private final LocalCacheService localCacheService;

    public PresenceEventConsumer(LocalCacheService localCacheService) {
        this.localCacheService = localCacheService;
    }

    @KafkaListener(topics = "presence-events", groupId = "notification-service-presence-group")
    public void consumePresenceEvent(PresenceEventDto event) {
        if (event == null || event.getUserId() == null) return;

        boolean isOnline = "ONLINE".equalsIgnoreCase(event.getStatus());
        localCacheService.setPresence(event.getUserId(), isOnline);
        
        log.debug("📩 Presence updated: {} is now {}", event.getUserId(), event.getStatus());
    }
}
