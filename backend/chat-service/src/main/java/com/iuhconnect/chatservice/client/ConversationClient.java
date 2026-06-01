package com.iuhconnect.chatservice.client;

import com.iuhconnect.chatservice.model.ConversationEntity;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

@FeignClient(name = "conversation-service", url = "${CONVERSATION_SERVICE_URL:http://localhost:8090}", fallbackFactory = ConversationClientFallbackFactory.class)
public interface ConversationClient {

    @GetMapping("/api/v1/chat/conversations/group/{conversationId}")
    ConversationEntity getConversation(@PathVariable("conversationId") String conversationId);

    @GetMapping("/api/v1/chat/conversations/user/{userId}")
    List<ConversationEntity> getUserConversations(@PathVariable("userId") String userId);
}
