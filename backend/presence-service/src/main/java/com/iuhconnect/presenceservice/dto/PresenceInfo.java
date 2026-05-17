package com.iuhconnect.presenceservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PresenceInfo {

    private String userId;

    /** "ONLINE" or "OFFLINE" */
    private String status;

    /** Unix timestamp in millis — last time user was seen online */
    private long lastSeen;
}
