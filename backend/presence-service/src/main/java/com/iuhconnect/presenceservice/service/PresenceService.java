package com.iuhconnect.presenceservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.presenceservice.dto.PresenceEventDto;
import com.iuhconnect.presenceservice.dto.PresenceInfo;
import com.iuhconnect.presenceservice.dto.WorkStatusInfo;
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
    private static final String WORK_STATUS_KEY_PREFIX = "workstatus:";
    private static final String AUTO_REPLY_KEY_PREFIX = "autoreply:";
    private static final String KAFKA_TOPIC = "presence-events";

    private final StringRedisTemplate redisTemplate;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public PresenceService(StringRedisTemplate redisTemplate,
                           KafkaTemplate<String, Object> kafkaTemplate) {
        this.redisTemplate = redisTemplate;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = new ObjectMapper();
    }

    // ========== Core Presence (unchanged logic) ==========

    /**
     * Mark user as ONLINE.
     * Stores status in Redis with a TTL (heartbeat must refresh it).
     */
    public void setOnline(String userId) {
        String key = PRESENCE_KEY_PREFIX + userId;
        long now = System.currentTimeMillis();

        // If user has a manual work status (BUSY/AVAILABLE), restore it as the presence value
        String workStatus = getWorkStatusRaw(userId);
        String presenceValue = ("BUSY".equals(workStatus) || "AVAILABLE".equals(workStatus))
                ? workStatus : "ONLINE";

        redisTemplate.opsForValue().set(key, presenceValue, 90, TimeUnit.SECONDS);
        redisTemplate.opsForValue().set(LAST_SEEN_KEY_PREFIX + userId, String.valueOf(now));

        log.info("🟢 User ONLINE: {} (presence={})", userId, presenceValue);

        // Publish event to Kafka
        publishEvent(userId, presenceValue, now, workStatus);
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
        publishEvent(userId, "OFFLINE", now, null);
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
     * Get presence info for a single user (enriched with work status).
     */
    public PresenceInfo getPresence(String userId) {
        boolean online = isOnline(userId);
        long lastSeen = getLastSeen(userId);
        String workStatus = getWorkStatusRaw(userId);
        boolean autoReplyEnabled = false;

        if ("BUSY".equals(workStatus)) {
            String autoReplyJson = redisTemplate.opsForValue().get(AUTO_REPLY_KEY_PREFIX + userId);
            if (autoReplyJson != null) {
                autoReplyEnabled = autoReplyJson.contains("\"enabled\":true");
            }
        }

        // Effective status for display
        String effectiveStatus;
        if (!online) {
            effectiveStatus = "OFFLINE";
        } else if ("BUSY".equals(workStatus)) {
            effectiveStatus = "BUSY";
        } else if ("AVAILABLE".equals(workStatus)) {
            effectiveStatus = "AVAILABLE";
        } else {
            effectiveStatus = "ONLINE";
        }

        return PresenceInfo.builder()
                .userId(userId)
                .status(effectiveStatus)
                .lastSeen(lastSeen)
                .workStatus(workStatus != null ? workStatus : "NONE")
                .autoReplyEnabled(autoReplyEnabled)
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

    // ========== UC10: Work Status Management ==========

    /**
     * Set the lecturer's manual work status.
     * - BUSY: also configures auto-reply in Redis
     * - AVAILABLE: clears auto-reply config
     * Updates the presence key to reflect the new status.
     */
    public void setWorkStatus(String userId, String status, String autoReplyMessage) {
        // Persist work status (no TTL — survives reconnections)
        redisTemplate.opsForValue().set(WORK_STATUS_KEY_PREFIX + userId, status);

        if ("BUSY".equals(status) && autoReplyMessage != null && !autoReplyMessage.isBlank()) {
            // Save auto-reply config as JSON
            try {
                Map<String, Object> config = new LinkedHashMap<>();
                config.put("enabled", true);
                config.put("message", autoReplyMessage);
                String json = objectMapper.writeValueAsString(config);
                redisTemplate.opsForValue().set(AUTO_REPLY_KEY_PREFIX + userId, json);
            } catch (Exception e) {
                log.error("Failed to serialize auto-reply config for {}: {}", userId, e.getMessage());
            }
        } else if ("AVAILABLE".equals(status)) {
            // Clear auto-reply when switching to AVAILABLE
            redisTemplate.delete(AUTO_REPLY_KEY_PREFIX + userId);
            // Clear debounce keys
            clearAutoReplyDebounceKeys(userId);
        }

        // Update presence key if user is currently online
        if (isOnline(userId)) {
            String presenceValue = ("BUSY".equals(status) || "AVAILABLE".equals(status)) ? status : "ONLINE";
            redisTemplate.opsForValue().set(PRESENCE_KEY_PREFIX + userId, presenceValue, 90, TimeUnit.SECONDS);

            long now = System.currentTimeMillis();
            publishEvent(userId, presenceValue, now, status);
        }

        log.info("📋 Work status set: {} → {} (autoReply={})", userId, status,
                autoReplyMessage != null ? "configured" : "none");
    }

    /**
     * Clear the lecturer's work status — back to normal ONLINE.
     */
    public void clearWorkStatus(String userId) {
        redisTemplate.delete(WORK_STATUS_KEY_PREFIX + userId);
        redisTemplate.delete(AUTO_REPLY_KEY_PREFIX + userId);
        clearAutoReplyDebounceKeys(userId);

        // Reset presence key to ONLINE if connected
        if (isOnline(userId)) {
            redisTemplate.opsForValue().set(PRESENCE_KEY_PREFIX + userId, "ONLINE", 90, TimeUnit.SECONDS);

            long now = System.currentTimeMillis();
            publishEvent(userId, "ONLINE", now, "NONE");
        }

        log.info("📋 Work status cleared for {}", userId);
    }

    /**
     * Get the work status and auto-reply config for a user.
     */
    public WorkStatusInfo getWorkStatusInfo(String userId) {
        String workStatus = getWorkStatusRaw(userId);
        boolean autoReplyEnabled = false;
        String autoReplyMessage = null;

        String autoReplyJson = redisTemplate.opsForValue().get(AUTO_REPLY_KEY_PREFIX + userId);
        if (autoReplyJson != null) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> config = objectMapper.readValue(autoReplyJson, Map.class);
                autoReplyEnabled = Boolean.TRUE.equals(config.get("enabled"));
                autoReplyMessage = (String) config.get("message");
            } catch (Exception e) {
                log.warn("Failed to parse auto-reply config for {}: {}", userId, e.getMessage());
            }
        }

        return WorkStatusInfo.builder()
                .userId(userId)
                .workStatus(workStatus != null ? workStatus : "NONE")
                .autoReplyEnabled(autoReplyEnabled)
                .autoReplyMessage(autoReplyMessage)
                .build();
    }

    // ========== Private Helpers ==========

    private String getWorkStatusRaw(String userId) {
        return redisTemplate.opsForValue().get(WORK_STATUS_KEY_PREFIX + userId);
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

    private void publishEvent(String userId, String status, long timestamp, String workStatus) {
        try {
            PresenceEventDto event = PresenceEventDto.builder()
                    .userId(userId)
                    .status(status)
                    .lastSeen(timestamp)
                    .workStatus(workStatus)
                    .build();
            kafkaTemplate.send(KAFKA_TOPIC, userId, event);
        } catch (Exception e) {
            log.warn("⚠️ Failed to publish presence event for {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Clean up debounce keys when lecturer leaves BUSY mode.
     * Pattern: autoreply:sent:{userId}:*
     */
    private void clearAutoReplyDebounceKeys(String userId) {
        try {
            Set<String> keys = redisTemplate.keys("autoreply:sent:" + userId + ":*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.debug("🧹 Cleared {} auto-reply debounce keys for {}", keys.size(), userId);
            }
        } catch (Exception e) {
            log.warn("Failed to clear debounce keys for {}: {}", userId, e.getMessage());
        }
    }
}
