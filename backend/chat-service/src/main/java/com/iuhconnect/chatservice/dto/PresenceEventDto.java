package com.iuhconnect.chatservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PresenceEventDto {
    private String userId;
    private String status; // ONLINE or OFFLINE
    private long lastSeen;
}
