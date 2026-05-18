package com.iuhconnect.notificationservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserEventDto {
    private Long userId;
    private String username;
    private String avatarUrl;
    private String eventType; // "USER_CREATED", "FCM_TOKEN_UPDATED"
    private String fcmToken;
}
