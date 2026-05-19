package com.iuhconnect.authservice.service;

import com.iuhconnect.authservice.dto.ContactEventDto;
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
    private static final String CONTACT_TOPIC = "contact-events";

    private final KafkaTemplate<String, UserEventDto> kafkaTemplate;
    private final KafkaTemplate<String, ContactEventDto> contactKafkaTemplate;

    public UserEventProducer(KafkaTemplate<String, UserEventDto> kafkaTemplate,
                             KafkaTemplate<String, ContactEventDto> contactKafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
        this.contactKafkaTemplate = contactKafkaTemplate;
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

    public void publishContactEvent(ContactEventDto event) {
        CompletableFuture<SendResult<String, ContactEventDto>> future =
                contactKafkaTemplate.send(CONTACT_TOPIC, event.getReceiverUsername(), event);

        future.whenComplete((result, ex) -> {
            if (ex == null) {
                log.info("✅ Published contact event to Kafka [topic={}, type={}, sender={}, receiver={}, offset={}]",
                        CONTACT_TOPIC, event.getEventType(),
                        event.getSenderUsername(), event.getReceiverUsername(),
                        result.getRecordMetadata().offset());
            } else {
                log.error("❌ Failed to publish contact event [sender={}, receiver={}]: {}",
                        event.getSenderUsername(), event.getReceiverUsername(), ex.getMessage());
            }
        });
    }
}
