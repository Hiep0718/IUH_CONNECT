package com.iuhconnect.chatservice.repository;

import com.iuhconnect.chatservice.model.MessageEntity;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends MongoRepository<MessageEntity, String> {

    /**
     * Fetch messages by conversationId, ordered by timestamp descending (newest first).
     */
    List<MessageEntity> findByConversationIdOrderByTimestampDesc(String conversationId);

    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
            "{ $match: { $or: [ { 'sender_id': ?0 }, { 'receiver_id': ?0 } ] } }",
            "{ $sort: { 'timestamp': -1 } }",
            "{ $group: { _id: '$conversation_id', doc: { $first: '$$ROOT' } } }",
            "{ $replaceRoot: { newRoot: '$doc' } }",
            "{ $sort: { 'timestamp': -1 } }"
    })
    List<MessageEntity> findRecentConversationsForUser(String userId);
}
