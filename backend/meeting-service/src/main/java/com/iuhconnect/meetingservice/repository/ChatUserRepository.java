package com.iuhconnect.meetingservice.repository;

import com.iuhconnect.meetingservice.model.ChatUser;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChatUserRepository extends MongoRepository<ChatUser, String> {

    Optional<ChatUser> findByUserId(Long userId);

    Optional<ChatUser> findByUsername(String username);
}
