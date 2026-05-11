package com.iuhconnect.chatservice.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.CallSignalDto;
import com.iuhconnect.chatservice.dto.WebRTCSignalingMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;

/**
 * Nhận signaling message từ Redis Pub/Sub (cross-instance).
 * Hỗ trợ cả CALL_SIGNAL (new) và WEBRTC (legacy).
 */
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
            JsonNode jsonNode = objectMapper.readTree(payload);
            String type = jsonNode.has("type") ? jsonNode.get("type").asText() : "WEBRTC";

            // Xác định receiverId tùy theo loại message
            String receiverId;
            if ("CALL_SIGNAL".equals(type)) {
                CallSignalDto signal = objectMapper.treeToValue(jsonNode, CallSignalDto.class);
                receiverId = signal.getReceiverId();
                log.info("📥 Call Signal from Redis [to={}, signalType={}]",
                        receiverId, signal.getSignalType());
            } else {
                // Legacy WEBRTC
                WebRTCSignalingMessage signalingMessage = objectMapper.treeToValue(jsonNode, WebRTCSignalingMessage.class);
                receiverId = signalingMessage.getReceiverId();
                log.info("📥 [Legacy] WebRTC Signal from Redis [to={}, signalType={}]",
                        receiverId, signalingMessage.getSignalType());
            }

            // Deliver tới local WebSocket session
            if (receiverId != null) {
                WebSocketSession session = sessionManager.getSession(receiverId);
                if (session != null && session.isOpen()) {
                    session.sendMessage(new TextMessage(payload));
                } else {
                    log.warn("⚠️ WebSocket session not found or closed for receiver: {}", receiverId);
                }
            }
        } catch (IOException e) {
            log.error("❌ Failed to process signaling message from Redis: {}", e.getMessage(), e);
        }
    }
}
