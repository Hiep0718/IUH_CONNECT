package com.iuhconnect.chatservice.repository;

import com.iuhconnect.chatservice.model.UserConversationSettings;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserConversationSettingsRepository extends MongoRepository<UserConversationSettings, String> {

    Optional<UserConversationSettings> findByUserIdAndConversationId(String userId, String conversationId);

    List<UserConversationSettings> findByUserIdAndPinnedTrue(String userId);

    List<UserConversationSettings> findByUserIdAndMutedTrue(String userId);

    List<UserConversationSettings> findByUserIdAndArchivedTrue(String userId);

    List<UserConversationSettings> findByUserIdAndDeletedTrue(String userId);

    List<UserConversationSettings> findByUserId(String userId);
}
