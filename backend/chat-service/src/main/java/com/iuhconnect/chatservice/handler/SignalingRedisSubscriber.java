package com.iuhconnect.chatservice.handler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;

@Component
public class SignalingRedisSubscriber implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(SignalingRedisSubscriber.class);

    private final WebSocketSessionManager sessionManager;

    public SignalingRedisSubscriber(WebSocketSessionManager sessionManager) {
        this.sessionManager = sessionManager;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String payload = new String(message.getBody());
            
            // Lấy receiverId từ payload
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode node = mapper.readTree(payload);
            
            String receiverId = null;
            if (node.has("receiverId")) {
                receiverId = node.get("receiverId").asText();
            }

            if (receiverId != null) {
                WebSocketSession session = sessionManager.getSession(receiverId);
                if (session != null && session.isOpen()) {
                    try {
                        session.sendMessage(new TextMessage(payload));
                        return;
                    } catch (Exception ex) {
                        log.warn("⚠️ Failed to deliver signal via Redis subscriber: {}", ex.getMessage());
                        try { session.close(); } catch (Exception ignore) {}
                    }
                }
            }
        } catch (IOException e) {
            log.error("❌ Failed to process signaling message from Redis: {}", e.getMessage(), e);
        }
    }
}
