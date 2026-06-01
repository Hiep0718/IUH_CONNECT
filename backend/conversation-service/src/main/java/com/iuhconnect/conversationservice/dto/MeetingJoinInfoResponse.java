package com.iuhconnect.conversationservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeetingJoinInfoResponse {
    private String meetingId;
    private String roomName;
    private String jitsiUrl;
}
