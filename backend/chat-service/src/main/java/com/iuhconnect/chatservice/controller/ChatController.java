package com.iuhconnect.chatservice.controller;

import com.iuhconnect.chatservice.dto.ChatReactionEventDto;
import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.service.MessageService;
import com.iuhconnect.chatservice.service.RealtimeEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final MessageService messageService;
    private final RealtimeEventService realtimeEventService;

    @GetMapping("/history/{conversationId}")
    public ResponseEntity<List<MessageEntity>> getHistory(
            @PathVariable String conversationId,
            @RequestParam(required = false) Long before,
            @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(messageService.getHistory(conversationId, before, limit));
    }

    @GetMapping("/conversations/{userId}")
    public ResponseEntity<List<com.iuhconnect.chatservice.dto.ConversationSummaryDto>> getRecentConversations(@PathVariable String userId) {
        return ResponseEntity.ok(messageService.getRecentConversations(userId));
    }

    @GetMapping("/history/{conversationId}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable String conversationId, @RequestParam String userId) {
        messageService.markAsRead(conversationId, userId);
        return ResponseEntity.ok().build();
    }
    @PutMapping("/messages/{messageId}/react")
    public ResponseEntity<MessageEntity> toggleReaction(
            @PathVariable String messageId,
            @RequestParam String userId,
            @RequestParam String emoji) {
        MessageEntity updatedMessage = messageService.toggleReaction(messageId, userId, emoji);

        Set<String> participants = new LinkedHashSet<>();
        participants.add(updatedMessage.getSenderId());
        participants.add(updatedMessage.getReceiverId());

        for (String participant : participants) {
            ChatReactionEventDto event = ChatReactionEventDto.builder()
                    .receiverId(participant)
                    .actorUserId(userId)
                    .conversationId(updatedMessage.getConversationId())
                    .messageId(updatedMessage.getId())
                    .timestamp(System.currentTimeMillis())
                    .reactions(updatedMessage.getReactions())
                    .build();
            realtimeEventService.sendToUser(participant, event);
        }

        return ResponseEntity.ok(updatedMessage);
    }

    // ======== Pin Message ========

    @PutMapping("/messages/{messageId}/pin")
    public ResponseEntity<MessageEntity> togglePinMessage(
            @PathVariable String messageId,
            @RequestParam String userId,
            @RequestParam String conversationId) {
        return ResponseEntity.ok(messageService.togglePinMessage(messageId, userId, conversationId));
    }

    @GetMapping("/messages/{conversationId}/pinned")
    public ResponseEntity<List<MessageEntity>> getPinnedMessages(
            @PathVariable String conversationId) {
        return ResponseEntity.ok(messageService.getPinnedMessages(conversationId));
    }
}
