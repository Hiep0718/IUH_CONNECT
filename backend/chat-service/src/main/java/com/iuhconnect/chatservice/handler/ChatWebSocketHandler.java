package com.iuhconnect.chatservice.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
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

    public ChatWebSocketHandler(WebSocketSessionManager sessionManager,
                                KafkaTemplate<String, ChatMessageDto> kafkaTemplate,
                                ObjectMapper objectMapper) {
        this.sessionManager = sessionManager;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String username = (String) session.getAttributes().get("username");
        sessionManager.registerSession(username, session);
        log.info("🔗 WebSocket connected [username={}, sessionId={}]", username, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            // 1. Parse JSON payload from client
            ChatMessageDto chatMessage = objectMapper.readValue(message.getPayload(), ChatMessageDto.class);

            // 2. Set timestamp if not provided
            if (chatMessage.getTimestamp() == 0) {
                chatMessage.setTimestamp(System.currentTimeMillis());
            }

            log.info("📤 Producing message to Kafka [from={}, to={}, conv={}]",
                    chatMessage.getSenderId(), chatMessage.getReceiverId(),
                    chatMessage.getConversationId());

            // 3. Produce to Kafka topic "chat-messages" with conversationId as key
            kafkaTemplate.send(TOPIC, chatMessage.getConversationId(), chatMessage);

        } catch (Exception e) {
            log.error("❌ Failed to process WebSocket message: {}", e.getMessage(), e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = (String) session.getAttributes().get("username");
        if (username != null) {
            sessionManager.removeSession(username);
        }
        log.info("🔌 WebSocket disconnected [username={}, status={}]", username, status);
    }
}
