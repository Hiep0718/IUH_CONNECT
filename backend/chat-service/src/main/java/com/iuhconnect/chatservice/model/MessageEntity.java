package com.iuhconnect.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "messages")
@CompoundIndexes({
        @CompoundIndex(name = "conv_ts_idx", def = "{'conversation_id': 1, 'timestamp': -1}")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageEntity {

    @Id
    private String id;

    @Field("sender_id")
    private String senderId;

    @Field("receiver_id")
    private String receiverId;

    private String content;

    @Field("conversation_id")
    private String conversationId;

    private long timestamp;

    // ---- Media fields ----
    @Field("message_type")
    @Builder.Default
    private String messageType = "TEXT";

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
    @Builder.Default
    private boolean isRead = false;

    @Field("unread_count")
    private Integer unreadCount;

    // ---- Reactions: { "❤️": ["user1","user2"], "😂": ["user3"] } ----
    private java.util.Map<String, java.util.List<String>> reactions;

    // ---- Reply ----
    @Field("reply_to_id")
    private String replyToId;

    @Field("reply_to_text")
    private String replyToText;

    @Field("reply_to_sender")
    private String replyToSender;

    // ---- Pin ----
    @Builder.Default
    private boolean pinned = false;

    @Field("pinned_by")
    private String pinnedBy;

    @Field("pinned_at")
    private long pinnedAt;

    // ---- Mentions ----
    /** List of user IDs mentioned in this message */
    private java.util.List<String> mentions;
}
