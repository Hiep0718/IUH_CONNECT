package com.iuhconnect.presenceservice.service;

import com.iuhconnect.presenceservice.dto.PresenceEventDto;
import com.iuhconnect.presenceservice.dto.PresenceInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class PresenceService {

    private static final Logger log = LoggerFactory.getLogger(PresenceService.class);
    private static final String PRESENCE_KEY_PREFIX = "presence:";
    private static final String LAST_SEEN_KEY_PREFIX = "lastseen:";
    private static final String KAFKA_TOPIC = "presence-events";

    private final StringRedisTemplate redisTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public PresenceService(StringRedisTemplate redisTemplate,
                           KafkaTemplate<String, Object> kafkaTemplate) {
        this.redisTemplate = redisTemplate;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Mark user as ONLINE.
     * Stores status in Redis with a TTL (heartbeat must refresh it).
     */
    public void setOnline(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        long now = System.currentTimeMillis();

        redisTemplate.opsForValue().set(key, "ONLINE", 90, TimeUnit.SECONDS);
        redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));

        log.info("🟢 User ONLINE: {}", userId);

        // Publish event to Kafka
        publishEvent(userId, "ONLINE", now);
    }

    /**
     * Mark user as OFFLINE.
     */
    public void setOffline(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        long now = System.currentTimeMillis();

        redisTemplate.delete(key);
        redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));

        log.info("🔴 User OFFLINE: {}", userId);

        // Publish event to Kafka
        publishEvent(userId, "OFFLINE", now);
    }

    /**
     * Refresh heartbeat — extend TTL so user stays ONLINE.
     */
    public void refreshHeartbeat(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        Boolean exists = redisTemplate.hasKey(key);

        if (Boolean.TRUE.equals(exists)) {
            redisTemplate.expire(key, 90, TimeUnit.SECONDS);
            redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId,
                    String.valueOf(System.currentTimeMillis()));
        } else {
            // Key expired — user reconnecting, set online again
            setOnline(userId);
        }
    }

    /**
     * Check if user is currently online.
     */
    public boolean isOnline(String userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(PRESENCE_KEY_PREFIX + userId));
    }

    /**
     * Get presence info for a single user.
     */
    public PresenceInfo getPresence(String userId) {
        boolean online = isOnline(userId);
        long lastSeen = getLastSeen(userId);

        return PresenceInfo.builder()
                .userId(userId)
                .status(online ? "ONLINE" : "OFFLINE")
                .lastSeen(lastSeen)
                .build();
    }

    /**
     * Get presence info for multiple users at once.
     */
    public Map<String, PresenceInfo> getBulkPresence(List<String> userIds) {
        Map<String, PresenceInfo> result = new LinkedHashMap<>();

        for (String userId : userIds) {
            result.put(userId, getPresence(userId));
        }

        return result;
    }

    private long getLastSeen(String userId) {
        String val = redisTemplate.opsForValue().get(LAST_SEEN_KEY_PREFIX + userId);
        if (val != null) {
            try {
                return Long.parseLong(val);
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return 0;
    }

    private void publishEvent(String userId, String status, long timestamp) {
        try {
            PresenceEventDto event = PresenceEventDto.builder()
                    .userId(userId)
                    .status(status)
                    .lastSeen(timestamp)
                    .build();
            kafkaTemplate.send(KAFKA_TOPIC, userId, event);
        } catch (Exception e) {
            log.warn("⚠️ Failed to publish presence event for {}: {}", userId, e.getMessage());
        }
    }
}
