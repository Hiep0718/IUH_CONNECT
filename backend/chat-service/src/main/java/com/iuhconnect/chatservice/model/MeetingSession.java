package com.iuhconnect.chatservice.model;

import lombok.*;

import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MeetingSession {
    private String meetingId;
    private String roomName;
    private String hostUserId;
    private Set<String> participantUserIds;
    private MeetingStatus status;
    private long createdAt;
    private long updatedAt;
}
