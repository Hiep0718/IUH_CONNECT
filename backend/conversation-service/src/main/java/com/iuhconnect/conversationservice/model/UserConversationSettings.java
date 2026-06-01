package com.iuhconnect.conversationservice.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

/**
 * Per-user settings for a conversation (pin, mute, archive, delete).
 * Each user has their own settings document for each conversation.
 */
@Document(collection = "user_conversation_settings")
@CompoundIndex(name = "user_conv_idx", def = "{'user_id': 1, 'conversation_id': 1}", unique = true)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserConversationSettings {

    @Id
    private String id;

    @Field("user_id")
    private String userId;

    @Field("conversation_id")
    private String conversationId;

    @Field("pinned")
    @Builder.Default
    private boolean pinned = false;

    @Field("pinned_at")
    private Long pinnedAt;

    @Field("muted")
    @Builder.Default
    private boolean muted = false;

    @Field("muted_until")
    private Long mutedUntil; // null = muted forever, timestamp = muted until

    @Field("archived")
    @Builder.Default
    private boolean archived = false;

    @Field("deleted")
    @Builder.Default
    private boolean deleted = false;

    @Field("deleted_at")
    private Long deletedAt; // Messages before this timestamp are hidden

    @Field("updated_at")
    private long updatedAt;
}
