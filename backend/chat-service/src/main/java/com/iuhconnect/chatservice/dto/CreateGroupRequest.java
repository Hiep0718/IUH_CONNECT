package com.iuhconnect.chatservice.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateGroupRequest {
    private String name;
    private String creatorId;
    private List<String> memberIds;
}
