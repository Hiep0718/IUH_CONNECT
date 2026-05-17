package com.iuhconnect.presenceservice.consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Listens for user-events from auth-service.
 * When a new user registers, we can initialize their presence state.
 */
@Component
public class UserEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(UserEventConsumer.class);

    @KafkaListener(topics = "user-events", groupId = "presence-service-group")
    public void consumeUserEvent(Map<String, Object> event) {
        if (event == null) {
            log.warn("⚠️ Received null user event, skipping.");
            return;
        }

        String eventType = (String) event.get("eventType");
        String username = (String) event.get("username");

        log.info("📩 Received user event [type={}, user={}]", eventType, username);

        if ("USER_REGISTERED".equals(eventType)) {
            log.info("👤 New user registered: {} — presence initialized as OFFLINE", username);
            // No action needed — absence of key in Redis means OFFLINE by default
        }
    }
}
