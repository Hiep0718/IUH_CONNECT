package com.iuhconnect.conversationservice.consumer;

import com.iuhconnect.conversationservice.dto.PresenceEventDto;
import com.iuhconnect.conversationservice.model.ConversationEntity;
import com.iuhconnect.conversationservice.model.GroupMember;
import com.iuhconnect.conversationservice.repository.ConversationRepository;
import com.iuhconnect.conversationservice.service.RealtimeEventService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class PresenceEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(PresenceEventConsumer.class);

    private final ConversationRepository conversationRepository;
    private final RealtimeEventService realtimeEventService;

    public PresenceEventConsumer(ConversationRepository conversationRepository,
                                 RealtimeEventService realtimeEventService) {
        this.conversationRepository = conversationRepository;
        this.realtimeEventService = realtimeEventService;
    }

    @KafkaListener(
            topics = "presence-events",
            groupId = "#{T(java.util.UUID).randomUUID().toString()}"
    )
    public void consumePresenceEvent(PresenceEventDto event) {
        if (event == null || event.getUserId() == null) {
            return;
        }

        log.info("🌐 Received presence event: user {} is {}", event.getUserId(), event.getStatus());

        // Find all conversations the user is in
        List<ConversationEntity> conversations = conversationRepository.findByMembersUserId(event.getUserId());

        // Prepare WS payload
        Map<String, Object> wsPayload = new HashMap<>();
        wsPayload.put("type", "PRESENCE_UPDATE");
        wsPayload.put("userId", event.getUserId());
        wsPayload.put("status", event.getStatus());
        wsPayload.put("lastSeen", event.getLastSeen());
        wsPayload.put("workStatus", event.getWorkStatus());

        // Notify all participants in those conversations (excluding the user themselves)
        conversations.stream()
                .flatMap(c -> c.getMembers().stream())
                .map(GroupMember::getUserId)
                .filter(participantId -> !participantId.equals(event.getUserId()))
                .distinct()
                .forEach(participantId -> {
                    log.debug("📡 Notifying {} about presence of {}", participantId, event.getUserId());
                    realtimeEventService.sendToUser(participantId, wsPayload);
                });
    }
}
