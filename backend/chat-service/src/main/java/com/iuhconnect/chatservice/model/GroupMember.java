package com.iuhconnect.chatservice.model;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMember {
    private String userId;
    private GroupRole role;
    private long joinedAt;
}
