package com.iuhconnect.presenceservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkStatusRequest {

    /** "BUSY" or "AVAILABLE" */
    private String status;

    /** Auto-reply message template (only used when status = BUSY) */
    private String autoReplyMessage;
}
