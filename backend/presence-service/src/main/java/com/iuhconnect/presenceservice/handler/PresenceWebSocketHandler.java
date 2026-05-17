package com.iuhconnect.presenceservice.handler;

import com.iuhconnect.presenceservice.service.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for presence heartbeat connections.
 *
 * Flow:
 * 1. Client connects to /ws/presence?token=JWT
 * 2. On connect → user marked ONLINE in Redis + Kafka event published
 * 3. Client sends "PING" every 30s → server refreshes TTL in Redis
 * 4. On disconnect → user marked OFFLINE in Redis + Kafka event published
 * 5. If client crashes (no disconnect), Redis TTL (90s) auto-expires → cleanup
 */
@Component
public class PresenceWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(PresenceWebSocketHandler.class);

    private final PresenceService presenceService;

    // Track active sessions: username → WebSocketSession
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public PresenceWebSocketHandler(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String username = (String) session.getAttributes().get("username");
        if (username == null) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }

        sessions.put(username, session);
        presenceService.setOnline(username);

        // Send acknowledgment
        session.sendMessage(new TextMessage("{\"type\":\"CONNECTED\",\"status\":\"ONLINE\"}"));

        log.info("🔗 Presence WS connected [username={}, total={}]", username, sessions.size());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String username = (String) session.getAttributes().get("username");
        if (username == null) return;

        String payload = message.getPayload().trim();

        if ("PING".equalsIgnoreCase(payload) || payload.contains("\"type\":\"PING\"")) {
            // Heartbeat — refresh TTL
            presenceService.refreshHeartbeat(username);

            try {
                session.sendMessage(new TextMessage("{\"type\":\"PONG\"}"));
            } catch (Exception e) {
                log.warn("⚠️ Failed to send PONG to {}: {}", username, e.getMessage());
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String username = (String) session.getAttributes().get("username");
        if (username != null) {
            sessions.remove(username);
            presenceService.setOffline(username);
        }
        log.info("🔌 Presence WS disconnected [username={}, status={}, total={}]",
                username, status, sessions.size());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        String username = (String) session.getAttributes().get("username");
        log.error("❌ Presence WS transport error [username={}]: {}", username, exception.getMessage());
    }

    /**
     * Get the number of active presence connections on this instance.
     */
    public int getActiveConnectionCount() {
        return sessions.size();
    }
}
