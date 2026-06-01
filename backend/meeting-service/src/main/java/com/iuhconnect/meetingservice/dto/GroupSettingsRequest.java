package com.iuhconnect.meetingservice.dto;

import lombok.Data;

@Data
public class GroupSettingsRequest {
    private Boolean requireApproval;
    private Boolean allowMemberInvite;
}
