package com.iuhconnect.chatservice.handler.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.chatservice.dto.CallSignalDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class CallSignalStrategy implements WsMessageStrategy {

    private static final Logger log = LoggerFactory.getLogger(CallSignalStrategy.class);
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public CallSignalStrategy(@Qualifier("presenceKafkaTemplate") KafkaTemplate<String, Object> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
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
            // Override senderId from authenticated session
            ((com.fasterxml.jackson.databind.node.ObjectNode) payload).put("senderId", senderUsername);

            CallSignalDto signal = objectMapper.treeToValue(payload, CallSignalDto.class);

            if (signal.getTimestamp() == 0) {
                signal.setTimestamp(System.currentTimeMillis());
            }

            // Publish to Kafka topic 'call-signals' for meeting-service to process
            kafkaTemplate.send("call-signals", signal.getReceiverId(), signal);

            log.info("📡 Forwarded CALL_SIGNAL to Kafka [signalType={}, from={}, to={}]",
                    signal.getSignalType(), signal.getSenderId(), signal.getReceiverId());
        } catch (Exception e) {
            log.error("❌ Failed to process CALL_SIGNAL message: {}", e.getMessage(), e);
        }
    }
}
