package com.iuhconnect.chatservice.handler;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Thread-safe manager for tracking WebSocket sessions per username.
 * Each node maintains its own session map — Redis Pub/Sub broadcasts
 * messages to ALL nodes so the correct node can deliver to its local sessions.
 */
@Component
public class WebSocketSessionManager {

    private static final Logger log = LoggerFactory.getLogger(WebSocketSessionManager.class);

    // username → WebSocketSession (1 session per user per node)
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public void registerSession(String username, WebSocketSession session) {
        sessions.put(username, session);
        log.info("📌 Session registered [username={}, sessionId={}, total={}]",
                username, session.getId(), sessions.size());
    }

    public void removeSession(String username) {
        sessions.remove(username);
        log.info("📌 Session removed [username={}, total={}]", username, sessions.size());
    }

    public WebSocketSession getSession(String username) {
        return sessions.get(username);
    }

    public boolean hasSession(String username) {
        return sessions.containsKey(username);
    }
}
