package com.iuhconnect.mediaservice.dto;

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
