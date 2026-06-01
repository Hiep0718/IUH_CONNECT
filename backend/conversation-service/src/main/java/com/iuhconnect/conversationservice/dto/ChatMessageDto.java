package com.iuhconnect.conversationservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessageDto {

    private String id;
    private String senderId;
    private String senderName;
    private String senderAvatar;
    private String receiverId;
    private String content;
    private String conversationId;
    private long timestamp;

    // ---- Media fields ----
    /** TEXT, IMAGE, VIDEO, FILE, STICKER */
    @Builder.Default
    private String messageType = "TEXT";

    /** URL of the media file on MinIO (after upload) */
    private String mediaUrl;

    /** Thumbnail URL (for images/videos) */
    private String thumbnailUrl;

    /** Original file name */
    private String fileName;

    /** File size in bytes */
    private long fileSize;

    /** MIME type, e.g. image/png, video/mp4 */
    private String mimeType;

    // ---- Reply ----
    private String replyToId;
    private String replyToText;
    private String replyToSender;

    // ---- Mentions ----
    /** List of user IDs mentioned in this message */
    private java.util.List<String> mentions;
}
