package com.iuhconnect.chatservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.WsEventDto;
import com.iuhconnect.chatservice.handler.WebSocketSessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class WsEventKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(WsEventKafkaConsumer.class);

    private final WebSocketSessionManager sessionManager;
    private final ObjectMapper objectMapper;

    public WsEventKafkaConsumer(WebSocketSessionManager sessionManager, ObjectMapper objectMapper) {
        this.sessionManager = sessionManager;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(
            topics = "ws-events",
            groupId = "#{T(java.util.UUID).randomUUID().toString()}"
    )
    public void consumeWsEvent(WsEventDto event) {
        if (event == null || event.getReceiverId() == null) {
            return;
        }

        try {
            WebSocketSession session = sessionManager.getSession(event.getReceiverId());
            if (session != null && session.isOpen()) {
                String body = objectMapper.writeValueAsString(event.getPayload());
                session.sendMessage(new TextMessage(body));
                log.debug("📡 Delivered ws-event to local session for user [{}]", event.getReceiverId());
            }
            // If session is null, it means the user is not connected to this specific instance.
            // Since this is a broadcast consumer, another instance that holds the session will deliver it.
        } catch (Exception e) {
            log.error("❌ Failed to deliver ws-event: {}", e.getMessage(), e);
        }
    }
}
