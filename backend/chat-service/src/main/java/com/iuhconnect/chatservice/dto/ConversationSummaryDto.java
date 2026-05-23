package com.iuhconnect.chatservice.dto;

import lombok.Data;
import org.springframework.data.mongodb.core.mapping.Field;

@Data
public class ConversationSummaryDto {
    private String id;

    @Field("sender_id")
    private String senderId;

    @Field("receiver_id")
    private String receiverId;

    private String content;

    @Field("conversation_id")
    private String conversationId;

    private long timestamp;

    @Field("message_type")
    private String messageType;

    @Field("media_url")
    private String mediaUrl;

    @Field("thumbnail_url")
    private String thumbnailUrl;

    @Field("file_name")
    private String fileName;

    @Field("file_size")
    private long fileSize;

    @Field("mime_type")
    private String mimeType;

    @Field("is_read")
    private boolean isRead;

    private Integer unreadCount;
}
