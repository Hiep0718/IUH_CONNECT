package com.iuhconnect.chatservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CallSignalDto {
    private String type;           // luôn là "CALL_SIGNAL"
    private String signalType;     // giá trị từ CallSignalType
    private String meetingId;
    private String roomName;
    private String senderId;       // backend override từ authenticated session
    private String senderName;
    private String receiverId;
    private long timestamp;
}
