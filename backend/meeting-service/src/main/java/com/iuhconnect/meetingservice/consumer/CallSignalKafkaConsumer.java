package com.iuhconnect.meetingservice.consumer;

import com.iuhconnect.meetingservice.dto.CallSignalDto;
import com.iuhconnect.meetingservice.service.CallSignalService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class CallSignalKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(CallSignalKafkaConsumer.class);

    private final CallSignalService callSignalService;

    public CallSignalKafkaConsumer(CallSignalService callSignalService) {
        this.callSignalService = callSignalService;
    }

    @KafkaListener(
            topics = "call-signals",
            groupId = "meeting-service-group"
    )
    public void consumeCallSignal(CallSignalDto signal) {
        if (signal == null) {
            log.warn("Received null call signal from Kafka.");
            return;
        }

        log.info("📥 Received CALL_SIGNAL from Kafka [signalType={}, from={}, to={}]",
                signal.getSignalType(), signal.getSenderId(), signal.getReceiverId());

        try {
            callSignalService.handleSignal(signal);
        } catch (Exception e) {
            log.error("❌ Failed to process CALL_SIGNAL from Kafka: {}", e.getMessage(), e);
        }
    }
}
