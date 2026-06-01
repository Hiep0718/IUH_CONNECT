package com.iuhconnect.mediaservice.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserEventDto {

    private Long userId;
    private String username;
    private String avatarUrl;
}
