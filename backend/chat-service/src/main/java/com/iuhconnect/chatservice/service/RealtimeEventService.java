package com.iuhconnect.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.WsEventDto;
import com.iuhconnect.chatservice.handler.WebSocketSessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Service
public class RealtimeEventService {

    private static final Logger log = LoggerFactory.getLogger(RealtimeEventService.class);

    private final WebSocketSessionManager sessionManager;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public RealtimeEventService(
            WebSocketSessionManager sessionManager,
            ObjectMapper objectMapper,
            KafkaTemplate<String, Object> kafkaTemplate
    ) {
        this.sessionManager = sessionManager;
        this.objectMapper = objectMapper;
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendToUser(String receiverId, Object payload) {
        if (receiverId == null || receiverId.isBlank()) {
            return;
        }

        try {
            WebSocketSession session = sessionManager.getSession(receiverId);
            if (session != null && session.isOpen()) {
                String body = objectMapper.writeValueAsString(payload);
                session.sendMessage(new TextMessage(body));
                return;
            }

            // If not connected locally, broadcast to other instances via Kafka
            kafkaTemplate.send("ws-events", new WsEventDto(receiverId, payload));
        } catch (Exception e) {
            log.error("Failed to deliver realtime event to [{}]: {}", receiverId, e.getMessage(), e);
        }
    }
}
