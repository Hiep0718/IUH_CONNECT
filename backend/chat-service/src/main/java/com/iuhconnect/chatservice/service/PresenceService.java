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

        // 2. Presence keys — same keys that presence-service REST API reads
        redisTemplate.opsForValue().set(PRESENCE_KEY_PREFIX + userId, "ONLINE", 90, TimeUnit.SECONDS);
        redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));

        log.info("🟢 User ONLINE (via chat-ws): {}", userId);

        // 3. Publish presence event to Kafka → other users get PRESENCE_UPDATE via WebSocket
        publishPresenceEvent(userId, "ONLINE", now);
    }

    public void userDisconnected(String userId) {
        long now = System.currentTimeMillis();

        // 1. Remove internal routing key
        redisTemplate.delete(INSTANCE_KEY_PREFIX + userId);

        // 2. Remove presence key + update lastSeen
        redisTemplate.delete(PRESENCE_KEY_PREFIX + userId);
        redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));

        log.info("🔴 User OFFLINE (via chat-ws): {}", userId);

        // 3. Publish presence event to Kafka
        publishPresenceEvent(userId, "OFFLINE", now);
    }

    /**
     * Refresh the presence heartbeat — extend TTL so user stays ONLINE in the presence API.
     * Called when the client sends a PING/heartbeat via the chat WebSocket.
     */
    public void refreshHeartbeat(String userId) {
        String presenceKey = PRESENCE_KEY_PREFIX + userId;
        Boolean exists = redisTemplate.hasKey(presenceKey);

        if (Boolean.TRUE.equals(exists)) {
            redisTemplate.expire(presenceKey, 90, TimeUnit.SECONDS);
            redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId,
                    String.valueOf(System.currentTimeMillis()));
        } else {
            // Key expired (e.g., no heartbeat for >90s) — re-establish as ONLINE
            long now = System.currentTimeMillis();
            redisTemplate.opsForValue().set(presenceKey, "ONLINE", 90, TimeUnit.SECONDS);
            redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));
            log.info("🔄 Re-established presence for {} (key had expired)", userId);
            publishPresenceEvent(userId, "ONLINE", now);
        }

        // Also refresh the routing key
        redisTemplate.expire(INSTANCE_KEY_PREFIX + userId, 24, TimeUnit.HOURS);
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
