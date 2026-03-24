package com.iuhconnect.chatservice.model;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

@Document(collection = "chat_users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatUser {

    @Id
    private String id;

    @Indexed(unique = true)
    @Field("user_id")
    private Long userId;

    @Indexed(unique = true)
    private String username;

    @Field("avatar_url")
    private String avatarUrl;
}
