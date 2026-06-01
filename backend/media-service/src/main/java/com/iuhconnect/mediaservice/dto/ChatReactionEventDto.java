package com.iuhconnect.mediaservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatReactionEventDto {

    @Builder.Default
    private String type = "CHAT_REACTION";

    private String receiverId;
    private String actorUserId;
    private String conversationId;
    private String messageId;
    private long timestamp;
    private Map<String, List<String>> reactions;
}
