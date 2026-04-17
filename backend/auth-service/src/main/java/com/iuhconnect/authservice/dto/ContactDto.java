package com.iuhconnect.authservice.dto;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ContactDto {
    private String username;
    private String fullName;
    private String avatarUrl;
    private String role;
    private String status; // PENDING, ACCEPTED
}
