package com.iuhconnect.conversationservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PresenceEventDto {
    private String userId;
    private String status; // ONLINE, OFFLINE, BUSY, AVAILABLE
    private long lastSeen;
    private String workStatus; // BUSY, AVAILABLE, or null
}
