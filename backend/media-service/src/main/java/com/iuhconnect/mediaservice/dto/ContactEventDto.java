package com.iuhconnect.mediaservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContactEventDto {

    private String eventType; // "FRIEND_REQUEST_SENT", "FRIEND_REQUEST_ACCEPTED"

    private String senderUsername;
    private String senderFullName;

    private String receiverUsername;
    private String receiverFullName;

    private long timestamp;
}
