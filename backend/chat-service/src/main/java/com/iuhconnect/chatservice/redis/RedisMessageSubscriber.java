package com.iuhconnect.chatservice.redis;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import com.iuhconnect.chatservice.handler.WebSocketSessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class RedisMessageSubscriber implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(RedisMessageSubscriber.class);

    private final WebSocketSessionManager sessionManager;
    private final ObjectMapper objectMapper;

    public RedisMessageSubscriber(WebSocketSessionManager sessionManager,
                                  ObjectMapper objectMapper) {
        this.sessionManager = sessionManager;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String json = new String(message.getBody());
            ChatMessageDto chatMessage = objectMapper.readValue(json, ChatMessageDto.class);

            log.info("📡 Redis message received [from={}, to={}]",
                    chatMessage.getSenderId(), chatMessage.getReceiverId());

            // Deliver to receiver if connected to THIS node
            deliverToUser(chatMessage.getReceiverId(), json);

            // Also deliver to sender (for multi-device sync)
            deliverToUser(chatMessage.getSenderId(), json);

        } catch (Exception e) {
            log.error("❌ Failed to process Redis message: {}", e.getMessage(), e);
        }
    }

    private void deliverToUser(String username, String json) {
        if (sessionManager.hasSession(username)) {
            WebSocketSession session = sessionManager.getSession(username);
            if (session != null && session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(json));
                    log.info("✅ Message delivered via WebSocket [username={}]", username);
                } catch (Exception e) {
                    log.error("❌ Failed to send WebSocket message [username={}]: {}",
                            username, e.getMessage());
                }
            }
        }
    }
}
