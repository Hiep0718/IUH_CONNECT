package com.iuhconnect.chatservice.client;

import com.iuhconnect.chatservice.model.ConversationEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.openfeign.FallbackFactory;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
public class ConversationClientFallbackFactory implements FallbackFactory<ConversationClient> {

    private static final Logger log = LoggerFactory.getLogger(ConversationClientFallbackFactory.class);

    @Override
    public ConversationClient create(Throwable cause) {
        return new ConversationClient() {
            @Override
            public ConversationEntity getConversation(String conversationId) {
                log.error("Fallback: Cannot fetch conversation {} due to: {}", conversationId, cause.getMessage());
                return null;
            }

            @Override
            public List<ConversationEntity> getUserConversations(String userId) {
                log.error("Fallback: Cannot fetch user conversations for {} due to: {}", userId, cause.getMessage());
                return Collections.emptyList();
            }
        };
    }
}
