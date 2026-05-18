package com.iuhconnect.notificationservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageDto {
    private String senderId;
    private String receiverId;
    private String content;
    private String conversationId;
    private long timestamp;
    private String messageType;
}
