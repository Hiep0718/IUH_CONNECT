package com.iuhconnect.authservice.service;

import com.iuhconnect.authservice.dto.UserEventDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

@Service
public class UserEventProducer {

    private static final Logger log = LoggerFactory.getLogger(UserEventProducer.class);
    private static final String TOPIC = "user-events";

    private final KafkaTemplate<String, UserEventDto> kafkaTemplate;

    public UserEventProducer(KafkaTemplate<String, UserEventDto> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishUserCreatedEvent(UserEventDto event) {
        CompletableFuture<SendResult<String, UserEventDto>> future =
                kafkaTemplate.send(TOPIC, String.valueOf(event.getUserId()), event);

        future.whenComplete((result, ex) -> {
            if (ex == null) {
                log.info("✅ Published user event to Kafka [topic={}, userId={}, offset={}]",
                        TOPIC, event.getUserId(),
                        result.getRecordMetadata().offset());
            } else {
                log.error("❌ Failed to publish user event [userId={}]: {}",
                        event.getUserId(), ex.getMessage());
            }
        });
    }
}
