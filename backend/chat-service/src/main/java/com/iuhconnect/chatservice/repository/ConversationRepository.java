package com.iuhconnect.chatservice.repository;

import com.iuhconnect.chatservice.model.ConversationEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationRepository extends MongoRepository<ConversationEntity, String> {
    @Query("{ 'members.userId': ?0 }")
    List<ConversationEntity> findByMembersUserId(String userId);
}
