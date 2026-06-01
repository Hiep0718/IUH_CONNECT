package com.iuhconnect.meetingservice.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class UserServiceClientFallbackFactory implements FallbackFactory<UserServiceClient> {
    @Override
    public UserServiceClient create(Throwable cause) {
        return new UserServiceClient() {
            @Override
            public String getUserAvatar(String userId) {
                log.warn("Fallback triggered for getUserAvatar, userId: {}, reason: {}", userId, cause.getMessage());
                return "default_avatar_url"; // return default string or empty
            }
        };
    }
}
