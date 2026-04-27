package com.iuhconnect.chatservice.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class PresenceService {

    private final StringRedisTemplate redisTemplate;

    @Value("${server.instance.id:${random.uuid}}")
    private String currentInstanceId;

    public PresenceService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public void userConnected(String userId) {
        // Set presence with a TTL to avoid stale sessions if server crashes
        // TTL can be refreshed periodically by the client or WebSocket pings
        redisTemplate.opsForValue().set("presence:user:" + userId, currentInstanceId, 24, TimeUnit.HOURS);
    }

    public void userDisconnected(String userId) {
        redisTemplate.delete("presence:user:" + userId);
    }

    public String getUserInstanceId(String userId) {
        return redisTemplate.opsForValue().get("presence:user:" + userId);
    }

    public String getCurrentInstanceId() {
        return currentInstanceId;
    }
}
