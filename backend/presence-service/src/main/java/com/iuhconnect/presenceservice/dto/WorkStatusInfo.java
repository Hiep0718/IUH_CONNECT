package com.iuhconnect.presenceservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkStatusInfo {

    private String userId;

    /** "BUSY", "AVAILABLE", or "NONE" */
    private String workStatus;

    private boolean autoReplyEnabled;

    private String autoReplyMessage;
}
