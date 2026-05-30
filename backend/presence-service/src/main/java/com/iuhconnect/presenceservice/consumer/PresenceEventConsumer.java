package com.iuhconnect.presenceservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.presenceservice.dto.PresenceEventDto;
import com.iuhconnect.presenceservice.service.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class PresenceEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PresenceEventConsumer.class);

    private final PresenceService presenceService;
    private final ObjectMapper objectMapper;

    public PresenceEventConsumer(PresenceService presenceService, ObjectMapper objectMapper) {
        this.presenceService = presenceService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "presence-events", groupId = "presence-service-group")
    public void consumePresenceEvent(String message) {
        try {
            PresenceEventDto event = objectMapper.readValue(message, PresenceEventDto.class);
            
            if (event.getUserId() == null) {
                return;
            }

            if ("ONLINE".equals(event.getStatus())) {
                if (!presenceService.isOnline(event.getUserId())) {
                    // User just connected
                    presenceService.setOnline(event.getUserId());
                } else {
                    // Heartbeat refresh
                    presenceService.refreshHeartbeat(event.getUserId());
                }
            } else if ("OFFLINE".equals(event.getStatus())) {
                presenceService.setOffline(event.getUserId());
            }

        } catch (Exception e) {
            log.error("❌ Failed to process presence event: {}", e.getMessage(), e);
        }
    }
}
