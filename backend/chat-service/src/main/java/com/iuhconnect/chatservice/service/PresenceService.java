package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.dto.PresenceEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class PresenceService {

    private static final Logger log = LoggerFactory.getLogger(PresenceService.class);

    /**
     * Key used by chat-service internally for WS routing (which instance hosts the session).
     */
    private static final String INSTANCE_KEY_PREFIX = "presence:user:";

    /**
     * Keys used by presence-service REST API to report ONLINE/OFFLINE status.
     * We write the SAME keys here so the presence-service can read them correctly.
     */
    private static final String PRESENCE_KEY_PREFIX = "presence:";
    private static final String LAST_SEEN_KEY_PREFIX = "lastseen:";

    private static final String PRESENCE_KAFKA_TOPIC = "presence-events";

    private final StringRedisTemplate redisTemplate;
    private final KafkaTemplate<String, Object> presenceKafkaTemplate;

    @Value("${server.instance.id:${random.uuid}}")
    private String currentInstanceId;

    public PresenceService(StringRedisTemplate redisTemplate,
                           KafkaTemplate<String, Object> presenceKafkaTemplate) {
        this.redisTemplate = redisTemplate;
        this.presenceKafkaTemplate = presenceKafkaTemplate;
    }

    public void userConnected(String userId) {
        long now = System.currentTimeMillis();

        // 1. Internal routing key — which chat-service instance hosts this session
        redisTemplate.opsForValue().set(INSTANCE_KEY_PREFIX + userId, currentInstanceId, 24, TimeUnit.HOURS);

        log.info("🟢 User ONLINE (via chat-ws): {} (delegating presence write to presence-service)", userId);

        // 2. Publish presence event to Kafka → presence-service will write presence data
        publishPresenceEvent(userId, "ONLINE", now);
    }

    public void userDisconnected(String userId) {
        long now = System.currentTimeMillis();

        // 1. Remove internal routing key
        redisTemplate.delete(INSTANCE_KEY_PREFIX + userId);

        log.info("🔴 User OFFLINE (via chat-ws): {} (delegating presence write to presence-service)", userId);

        // 2. Publish presence event to Kafka
        publishPresenceEvent(userId, "OFFLINE", now);
    }

    /**
     * Refresh the presence heartbeat — extend TTL so user stays ONLINE in the presence API.
     * Called when the client sends a PING/heartbeat via the chat WebSocket.
     */
    public void refreshHeartbeat(String userId) {
        // 1. Refresh internal routing key
        redisTemplate.expire(INSTANCE_KEY_PREFIX + userId, 24, TimeUnit.HOURS);
        
        // 2. Publish heartbeat to Kafka -> presence-service handles actual presence update
        publishPresenceEvent(userId, "ONLINE", System.currentTimeMillis());
    }

    public String getUserInstanceId(String userId) {
        return redisTemplate.opsForValue().get(INSTANCE_KEY_PREFIX + userId);
    }

    public String getCurrentInstanceId() {
        return currentInstanceId;
    }

    private void publishPresenceEvent(String userId, String status, long timestamp) {
        try {
            PresenceEventDto event = PresenceEventDto.builder()
                    .userId(userId)
                    .status(status)
                    .lastSeen(timestamp)
                    .build();
            presenceKafkaTemplate.send(PRESENCE_KAFKA_TOPIC, userId, event);
            log.debug("📡 Published presence event: {} → {}", userId, status);
        } catch (Exception e) {
            log.warn("⚠️ Failed to publish presence event for {}: {}", userId, e.getMessage());
        }
    }
}
