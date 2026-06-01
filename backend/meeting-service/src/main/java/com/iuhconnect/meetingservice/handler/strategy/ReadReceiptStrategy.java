package com.iuhconnect.meetingservice.handler.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.iuhconnect.meetingservice.handler.WebSocketSessionManager;
import com.iuhconnect.meetingservice.service.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class ReadReceiptStrategy implements WsMessageStrategy {

    private static final Logger log = LoggerFactory.getLogger(ReadReceiptStrategy.class);
    private final WebSocketSessionManager sessionManager;
    private final PresenceService presenceService;
    private final StringRedisTemplate redisTemplate;

    public ReadReceiptStrategy(WebSocketSessionManager sessionManager,
                               PresenceService presenceService,
                               StringRedisTemplate redisTemplate) {
        this.sessionManager = sessionManager;
        this.presenceService = presenceService;
        this.redisTemplate = redisTemplate;
    }

    @Override
    public String getType() {
        return "READ_RECEIPT";
    }

    @Override
    public void handle(WebSocketSession session, JsonNode payload) {
        try {
            // Forward READ_RECEIPT directly to the receiver without saving to DB
            String receiverId = payload.has("receiverId") ? payload.get("receiverId").asText() : null;
            if (receiverId != null) {
                WebSocketSession receiverSession = sessionManager.getSession(receiverId);
                String rawMessage = payload.toString();
                
                if (receiverSession != null && receiverSession.isOpen()) {
                    receiverSession.sendMessage(new TextMessage(rawMessage));
                } else {
                    String targetInstance = presenceService.getUserInstanceId(receiverId);
                    if (targetInstance != null) {
                        redisTemplate.convertAndSend("signaling:" + targetInstance, rawMessage);
                    }
                }
            }
        } catch (Exception e) {
            log.error("❌ Failed to process READ_RECEIPT: {}", e.getMessage(), e);
        }
    }
}
