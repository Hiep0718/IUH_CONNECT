package com.iuhconnect.chatservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.handler.WebSocketSessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Service
public class RealtimeEventService {

    private static final Logger log = LoggerFactory.getLogger(RealtimeEventService.class);

    private final WebSocketSessionManager sessionManager;
    private final PresenceService presenceService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public RealtimeEventService(
            WebSocketSessionManager sessionManager,
            PresenceService presenceService,
            StringRedisTemplate redisTemplate,
            ObjectMapper objectMapper
    ) {
        this.sessionManager = sessionManager;
        this.presenceService = presenceService;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public void sendToUser(String receiverId, Object payload) {
        if (receiverId == null || receiverId.isBlank()) {
            return;
        }

        try {
            String body = objectMapper.writeValueAsString(payload);
            WebSocketSession session = sessionManager.getSession(receiverId);
            if (session != null && session.isOpen()) {
                session.sendMessage(new TextMessage(body));
                return;
            }

            String targetInstance = presenceService.getUserInstanceId(receiverId);
            if (targetInstance != null) {
                redisTemplate.convertAndSend("signaling:" + targetInstance, body);
            } else {
                log.debug("No active session found for realtime event receiver [{}]", receiverId);
            }
        } catch (Exception e) {
            log.error("Failed to deliver realtime event to [{}]: {}", receiverId, e.getMessage(), e);
        }
    }
}
