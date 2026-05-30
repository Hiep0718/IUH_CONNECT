package com.iuhconnect.chatservice.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.CallSignalDto;
import com.iuhconnect.chatservice.dto.ChatMessageDto;
import com.iuhconnect.chatservice.service.CallSignalService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import com.fasterxml.jackson.databind.JsonNode;
import com.iuhconnect.chatservice.handler.strategy.WsMessageStrategy;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.stream.Collectors;
import java.util.List;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketHandler.class);
    private static final String TOPIC = "chat-messages";

    private final WebSocketSessionManager sessionManager;
    private final com.iuhconnect.chatservice.service.PresenceService presenceService;
    private final ObjectMapper objectMapper;
    private final Map<String, WsMessageStrategy> strategies;

    public ChatWebSocketHandler(WebSocketSessionManager sessionManager,
                                com.iuhconnect.chatservice.service.PresenceService presenceService,
                                ObjectMapper objectMapper,
                                List<WsMessageStrategy> strategyList) {
        this.sessionManager = sessionManager;
        this.presenceService = presenceService;
        this.objectMapper = objectMapper;
        // Map Strategy beans into a dictionary by their getType() identifier
        this.strategies = strategyList.stream()
                .collect(Collectors.toMap(WsMessageStrategy::getType, strategy -> strategy));
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

            // 2. Delegate to Strategy
            WsMessageStrategy strategy = strategies.get(type);
            if (strategy != null) {
                strategy.handle(session, jsonNode);
            } else {
                // Default fallback
                strategies.get("CHAT").handle(session, jsonNode);
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
