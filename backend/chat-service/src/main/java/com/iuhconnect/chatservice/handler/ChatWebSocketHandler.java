package com.iuhconnect.chatservice.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.iuhconnect.chatservice.dto.WebRTCSignalingMessage;
import com.iuhconnect.chatservice.service.PresenceService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private static final String TOPIC = "chat-messages";

    private final WebSocketSessionManager sessionManager;
    private final KafkaTemplate<String, ChatMessageDto> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final PresenceService presenceService;
    private final StringRedisTemplate redisTemplate;

    public ChatWebSocketHandler(WebSocketSessionManager sessionManager,
                                KafkaTemplate<String, ChatMessageDto> kafkaTemplate,
                                ObjectMapper objectMapper,
                                PresenceService presenceService,
                                StringRedisTemplate redisTemplate) {
        this.sessionManager = sessionManager;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
        this.presenceService = presenceService;
        this.redisTemplate = redisTemplate;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String username = (String) session.getAttributes().get("username");
        sessionManager.registerSession(username, session);
        if (username != null) {
            presenceService.userConnected(username);
        }
        log.info("🔗 WebSocket connected [username={}, sessionId={}]", username, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            // 1. Parse JSON payload to check message type
            JsonNode jsonNode = objectMapper.readTree(message.getPayload());
            String type = jsonNode.has("type") ? jsonNode.get("type").asText() : "CHAT";

            if ("WEBRTC".equals(type)) {
                // WebRTC Signaling routing
                String senderUsername = (String) session.getAttributes().get("username");

                // Inject authenticated senderId into the message
                ((com.fasterxml.jackson.databind.node.ObjectNode) jsonNode).put("senderId", senderUsername);
                String enrichedPayload = objectMapper.writeValueAsString(jsonNode);

                WebRTCSignalingMessage signalingMessage = objectMapper.treeToValue(jsonNode, WebRTCSignalingMessage.class);
                String receiverId = signalingMessage.getReceiverId();
                String signalType = signalingMessage.getSignalType();

                log.info("📡 WebRTC Signal [type={}, from={}, to={}]", signalType, senderUsername, receiverId);

                // Try direct local session delivery first (fastest path)
                WebSocketSession receiverSession = sessionManager.getSession(receiverId);
                if (receiverSession != null && receiverSession.isOpen()) {
                    receiverSession.sendMessage(new TextMessage(enrichedPayload));
                    log.info("✅ WebRTC Signal delivered directly [to={}]", receiverId);
                } else {
                    // Fallback: route via Redis Pub/Sub to other instances
                    String targetInstance = presenceService.getUserInstanceId(receiverId);
                    if (targetInstance != null) {
                        redisTemplate.convertAndSend("signaling:" + targetInstance, enrichedPayload);
                        log.info("📡 WebRTC Signal routed via Redis [to={}, instance={}]", receiverId, targetInstance);
                    } else {
                        log.warn("⚠️ WebRTC Receiver {} is not online. (sender={}, signal={})", receiverId, senderUsername, signalType);
                    }
                }
            } else {
                // Standard Chat Message to Kafka
                ChatMessageDto chatMessage = objectMapper.treeToValue(jsonNode, ChatMessageDto.class);

                if (chatMessage.getTimestamp() == 0) {
                    chatMessage.setTimestamp(System.currentTimeMillis());
                }

                log.info("📤 Producing message to Kafka [from={}, to={}, conv={}]",
                        chatMessage.getSenderId(), chatMessage.getReceiverId(),
                        chatMessage.getConversationId());

                kafkaTemplate.send(TOPIC, chatMessage.getConversationId(), chatMessage);
            }

        } catch (Exception e) {
            log.error("❌ Failed to process WebSocket message: {}", e.getMessage(), e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = (String) session.getAttributes().get("username");
        if (username != null) {
            sessionManager.removeSession(username);
            presenceService.userDisconnected(username);
        }
        log.info("🔌 WebSocket disconnected [username={}, status={}]", username, status);
    }
}
