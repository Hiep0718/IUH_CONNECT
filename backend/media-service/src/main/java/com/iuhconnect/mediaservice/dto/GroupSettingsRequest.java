package com.iuhconnect.mediaservice.dto;

import lombok.Data;

@Data
public class GroupSettingsRequest {
    private Boolean requireApproval;
    private Boolean allowMemberInvite;
}
