package com.iuhconnect.presenceservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PresenceEventDto {

    private String userId;

    /** "ONLINE" or "OFFLINE" */
    private String status;

    /** Unix timestamp in millis */
    private long lastSeen;
}
