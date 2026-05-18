package com.iuhconnect.notificationservice.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class LocalCacheService {

    // Cache lưu trữ trạng thái Online/Offline (TTL 5 phút, sẽ được refresh bởi presence-events)
    private final Cache<String, Boolean> presenceCache = Caffeine.newBuilder()
            .expireAfterWrite(5, TimeUnit.MINUTES)
            .maximumSize(100_000)
            .build();

    // Cache lưu trữ FCM Token (TTL 30 ngày)
    private final Cache<String, String> tokenCache = Caffeine.newBuilder()
            .expireAfterWrite(30, TimeUnit.DAYS)
            .maximumSize(100_000)
            .build();

    // --- Presence ---
    public void setPresence(String userId, boolean isOnline) {
        presenceCache.put(userId, isOnline);
    }

    public boolean isOnline(String userId) {
        Boolean isOnline = presenceCache.getIfPresent(userId);
        return isOnline != null && isOnline;
    }

    // --- Token ---
    public void setToken(String userId, String token) {
        if (token != null && !token.trim().isEmpty()) {
            tokenCache.put(userId, token);
        } else {
            tokenCache.invalidate(userId);
        }
    }

    public String getToken(String userId) {
        return tokenCache.getIfPresent(userId);
    }

    public void removeToken(String userId) {
        tokenCache.invalidate(userId);
    }
}
