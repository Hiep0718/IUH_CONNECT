package com.iuhconnect.conversationservice.service;

import com.iuhconnect.conversationservice.dto.WsEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class RealtimeEventService {

    private static final Logger log = LoggerFactory.getLogger(RealtimeEventService.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public RealtimeEventService(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void sendToUser(String receiverId, Object payload) {
        if (receiverId == null || receiverId.isBlank()) {
            return;
        }

        try {
            kafkaTemplate.send("ws-events", new WsEventDto(receiverId, payload));
        } catch (Exception e) {
            log.error("Failed to deliver realtime event to [{}]: {}", receiverId, e.getMessage(), e);
        }
    }
}
