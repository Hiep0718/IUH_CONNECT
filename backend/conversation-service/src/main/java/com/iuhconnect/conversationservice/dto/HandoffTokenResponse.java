package com.iuhconnect.conversationservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HandoffTokenResponse {
    private String handoffToken;
    private String meetingUrl;
}
