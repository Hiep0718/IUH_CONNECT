package com.iuhconnect.chatservice.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.WebRTCSignalingMessage;
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
    private final ObjectMapper objectMapper;

    public SignalingRedisSubscriber(WebSocketSessionManager sessionManager, ObjectMapper objectMapper) {
        this.sessionManager = sessionManager;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        try {
            String payload = new String(message.getBody());
            WebRTCSignalingMessage signalingMessage = objectMapper.readValue(payload, WebRTCSignalingMessage.class);

            log.info("📥 Received WebRTC signaling from Redis Pub/Sub [to={}, signalType={}]",
                    signalingMessage.getReceiverId(), signalingMessage.getSignalType());

            WebSocketSession session = sessionManager.getSession(signalingMessage.getReceiverId());
            if (session != null && session.isOpen()) {
                session.sendMessage(new TextMessage(payload));
            } else {
                log.warn("⚠️ WebSocket session not found or closed for receiver: {}", signalingMessage.getReceiverId());
            }
        } catch (IOException e) {
            log.error("❌ Failed to process signaling message from Redis: {}", e.getMessage(), e);
        }
    }
}
