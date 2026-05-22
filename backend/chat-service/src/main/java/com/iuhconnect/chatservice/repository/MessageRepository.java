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
    List<MessageEntity> findByConversationIdOrderByTimestampDesc(String conversationId, org.springframework.data.domain.Pageable pageable);

    /**
     * Fetch messages by conversationId before a specific timestamp, for cursor-based pagination.
     */
    List<MessageEntity> findByConversationIdAndTimestampLessThanOrderByTimestampDesc(String conversationId, long timestamp, org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.mongodb.repository.Aggregation(pipeline = {
            "{ $match: { $or: [ { 'sender_id': ?0 }, { 'receiver_id': ?0 }, { 'conversation_id': { $in: ?1 } } ] } }",
            "{ $sort: { 'timestamp': -1 } }",
            "{ $group: { _id: '$conversation_id', doc: { $first: '$$ROOT' }, unreadCount: { $sum: { $cond: [ { $and: [ { $eq: ['$receiver_id', ?0] }, { $ne: ['$is_read', true] } ] }, 1, 0 ] } } } }",
            "{ $addFields: { 'doc.unread_count': '$unreadCount' } }",
            "{ $replaceRoot: { newRoot: '$doc' } }",
            "{ $sort: { 'timestamp': -1 } }"
    })
    List<com.iuhconnect.chatservice.dto.ConversationSummaryDto> findRecentConversationsForUser(String userId, List<String> groupIds);
}
