package com.iuhconnect.chatservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WebRTCSignalingMessage {
    private String type; // "WEBRTC"
    private String senderId;
    private String receiverId;
    private String signalType; // "OFFER", "ANSWER", "ICE_CANDIDATE", "CALL_END", "REJECT"
    private Object payload; // WebRTC SDP or ICE candidate JSON
}
