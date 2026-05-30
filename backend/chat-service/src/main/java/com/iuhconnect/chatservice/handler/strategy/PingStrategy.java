package com.iuhconnect.chatservice.handler.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.iuhconnect.chatservice.service.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class PingStrategy implements WsMessageStrategy {

    private static final Logger log = LoggerFactory.getLogger(PingStrategy.class);
    private final PresenceService presenceService;

    public PingStrategy(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @Override
    public String getType() {
        return "PING";
    }

    @Override
    public void handle(WebSocketSession session, JsonNode payload) {
        String username = (String) session.getAttributes().get("username");
        if (username != null) {
            presenceService.refreshHeartbeat(username);
        }
        try {
            session.sendMessage(new TextMessage("{\"type\":\"PONG\"}"));
        } catch (Exception e) {
            log.warn("⚠️ Failed to send PONG to session {}: {}", session.getId(), e.getMessage());
        }
    }
}
