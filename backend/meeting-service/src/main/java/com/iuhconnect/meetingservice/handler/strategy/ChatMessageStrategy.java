package com.iuhconnect.meetingservice.handler.strategy;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.meetingservice.dto.ChatMessageDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class ChatMessageStrategy implements WsMessageStrategy {

    private static final Logger log = LoggerFactory.getLogger(ChatMessageStrategy.class);
    private final KafkaTemplate<String, ChatMessageDto> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public ChatMessageStrategy(KafkaTemplate<String, ChatMessageDto> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public String getType() {
        return "CHAT"; // Default fallback type for chat messages
    }

    @Override
    public void handle(WebSocketSession session, JsonNode payload) {
        try {
            String senderUsername = (String) session.getAttributes().get("username");
            // Override senderId from authenticated session — never trust client
            ((com.fasterxml.jackson.databind.node.ObjectNode) payload).put("senderId", senderUsername);

            ChatMessageDto chatMessage = objectMapper.treeToValue(payload, ChatMessageDto.class);

            if (chatMessage.getTimestamp() == 0) {
                chatMessage.setTimestamp(System.currentTimeMillis());
            }

            // Default messageType if not set
            if (chatMessage.getMessageType() == null || chatMessage.getMessageType().isEmpty()) {
                chatMessage.setMessageType("TEXT");
            }

            // Produce to Kafka, topic 'chat-messages'
            // The ChatMessageKafkaConsumer will pick it up, save to DB, and broadcast
            String partitionKey = chatMessage.getConversationId();
            kafkaTemplate.send("chat-messages", partitionKey, chatMessage);

            log.debug("Published message to Kafka [conversationId={}]", partitionKey);
        } catch (Exception e) {
            log.error("❌ Failed to process CHAT message: {}", e.getMessage(), e);
        }
    }
}
