package com.iuhconnect.conversationservice.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.List;

@Document(collection = "conversations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConversationEntity {

    @Id
    private String id;

    private String name; // Only for GROUP

    private String avatar; // Only for GROUP

    @Field("type")
    private ConversationType type; // SINGLE or GROUP

    @Field("creator_id")
    private String creatorId; // The one who created the group

    @Field("members")
    private List<GroupMember> members;

    @Field("created_at")
    private long createdAt;

    @Field("updated_at")
    private long updatedAt;

    @Field("last_message_id")
    private String lastMessageId;

    @Field("require_approval")
    @Builder.Default
    private boolean requireApproval = false;

    @Field("allow_member_invite")
    @Builder.Default
    private boolean allowMemberInvite = true;

    @Field("pending_members")
    private List<GroupMember> pendingMembers;
}
