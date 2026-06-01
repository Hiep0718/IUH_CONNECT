package com.iuhconnect.conversationservice.dto;

import lombok.Data;

@Data
public class GroupSettingsRequest {
    private Boolean requireApproval;
    private Boolean allowMemberInvite;
}
