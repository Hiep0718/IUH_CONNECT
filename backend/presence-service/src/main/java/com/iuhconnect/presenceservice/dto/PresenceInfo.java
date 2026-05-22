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

    /** Lecturer work status: "BUSY", "AVAILABLE", or "NONE" */
    @Builder.Default
    private String workStatus = "NONE";

    /** Whether auto-reply is currently active (only when BUSY) */
    private boolean autoReplyEnabled;
}
