package com.iuhconnect.mediaservice.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.mediaservice.dto.ContactEventDto;
import com.iuhconnect.mediaservice.handler.WebSocketSessionManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.HashMap;
import java.util.Map;

/**
 * Consumes contact events from Kafka and forwards them to the target user
 * via WebSocket for real-time updates on friend requests/acceptances.
 * Uses random group ID so ALL chat-service instances receive the event
 * (broadcast pattern), ensuring the correct node with the user's WS session delivers it.
 */
@Component
public class ContactEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(ContactEventConsumer.class);

    private final WebSocketSessionManager sessionManager;
    private final ObjectMapper objectMapper;

    public ContactEventConsumer(WebSocketSessionManager sessionManager,
                                ObjectMapper objectMapper) {
        this.sessionManager = sessionManager;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(
            topics = "contact-events",
            groupId = "#{T(java.util.UUID).randomUUID().toString()}"
    )
    public void consumeContactEvent(ContactEventDto event) {
        if (event == null || event.getReceiverUsername() == null) {
            log.warn("⚠️ Received null or invalid contact event, skipping.");
            return;
        }

        log.info("📩 Received contact event [type={}, sender={}, receiver={}]",
                event.getEventType(), event.getSenderUsername(), event.getReceiverUsername());

        try {
            // Build WebSocket message payload
            Map<String, Object> wsPayload = new HashMap<>();
            wsPayload.put("type", "CONTACT_EVENT");
            wsPayload.put("eventType", event.getEventType());
            wsPayload.put("senderUsername", event.getSenderUsername());
            wsPayload.put("senderFullName", event.getSenderFullName());
            wsPayload.put("receiverUsername", event.getReceiverUsername());
            wsPayload.put("receiverFullName", event.getReceiverFullName());
            wsPayload.put("timestamp", event.getTimestamp());

            String payload = objectMapper.writeValueAsString(wsPayload);

            // Send to receiver via WebSocket (if connected to this instance)
            WebSocketSession receiverSession = sessionManager.getSession(event.getReceiverUsername());
            if (receiverSession != null && receiverSession.isOpen()) {
                receiverSession.sendMessage(new TextMessage(payload));
                log.info("📡 Forwarded contact event to user [{}] via WebSocket", event.getReceiverUsername());
            }

            // Also notify the sender (for UI sync, e.g., "Lời mời đã gửi" confirmation in real-time)
            if ("FRIEND_REQUEST_ACCEPTED".equals(event.getEventType())) {
                // For ACCEPTED events, the sender field is the person who accepted,
                // and receiver is the original requester. Both should be notified.
                // The receiver (original requester) is already handled above.
            }

            // For FRIEND_REQUEST_SENT, also notify the sender that it was sent successfully
            // (optional — useful for multi-device sync)
            WebSocketSession senderSession = sessionManager.getSession(event.getSenderUsername());
            if (senderSession != null && senderSession.isOpen()) {
                senderSession.sendMessage(new TextMessage(payload));
                log.info("📡 Forwarded contact event to sender [{}] via WebSocket", event.getSenderUsername());
            }

        } catch (Exception e) {
            log.error("❌ Failed to forward contact event to WebSocket: {}", e.getMessage(), e);
        }
    }
}
