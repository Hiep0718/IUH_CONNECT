package com.iuhconnect.chatservice.handler.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.CallSignalDto;
import com.iuhconnect.chatservice.service.CallSignalService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class CallSignalStrategy implements WsMessageStrategy {

    private static final Logger log = LoggerFactory.getLogger(CallSignalStrategy.class);
    private final CallSignalService callSignalService;
    private final ObjectMapper objectMapper;

    public CallSignalStrategy(CallSignalService callSignalService, ObjectMapper objectMapper) {
        this.callSignalService = callSignalService;
        this.objectMapper = objectMapper;
    }

    @Override
    public String getType() {
        return "CALL_SIGNAL";
    }

    @Override
    public void handle(WebSocketSession session, JsonNode payload) {
        try {
            String senderUsername = (String) session.getAttributes().get("username");
            // Override senderId from authenticated session — never trust client
            ((com.fasterxml.jackson.databind.node.ObjectNode) payload).put("senderId", senderUsername);

            CallSignalDto signal = objectMapper.treeToValue(payload, CallSignalDto.class);
            callSignalService.handleSignal(signal);
        } catch (Exception e) {
            log.error("❌ Failed to process CALL_SIGNAL: {}", e.getMessage(), e);
        }
    }
}
