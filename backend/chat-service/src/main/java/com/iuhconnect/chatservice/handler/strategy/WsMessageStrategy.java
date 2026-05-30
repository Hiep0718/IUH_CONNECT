package com.iuhconnect.chatservice.handler.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.socket.WebSocketSession;

public interface WsMessageStrategy {
    /**
     * @return type of message (e.g. "PING", "CHAT", "CALL_SIGNAL")
     */
    String getType();

    /**
     * Handle the specific type of WebSocket message.
     */
    void handle(WebSocketSession session, JsonNode payload);
}
