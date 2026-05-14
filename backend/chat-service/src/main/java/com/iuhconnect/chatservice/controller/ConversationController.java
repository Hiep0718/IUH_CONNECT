package com.iuhconnect.chatservice.controller;

import com.iuhconnect.chatservice.dto.CreateGroupRequest;
import com.iuhconnect.chatservice.model.ConversationEntity;
import com.iuhconnect.chatservice.service.ConversationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat/conversations")
@RequiredArgsConstructor
public class ConversationController {

    private final ConversationService conversationService;

    @PostMapping("/group")
    public ResponseEntity<ConversationEntity> createGroup(@RequestBody CreateGroupRequest request) {
        return ResponseEntity.ok(conversationService.createGroup(request));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<ConversationEntity>> getUserConversations(@PathVariable String userId) {
        return ResponseEntity.ok(conversationService.getUserConversations(userId));
    }

    @GetMapping("/group/{conversationId}")
    public ResponseEntity<ConversationEntity> getConversation(@PathVariable String conversationId) {
        return ResponseEntity.ok(conversationService.getConversation(conversationId));
    }

    @PutMapping("/group/{conversationId}/name")
    public ResponseEntity<ConversationEntity> updateGroupName(
            @PathVariable String conversationId,
            @RequestParam String requesterId,
            @RequestParam String newName) {
        return ResponseEntity.ok(conversationService.updateGroupName(conversationId, requesterId, newName));
    }

    @PostMapping("/group/{conversationId}/members")
    public ResponseEntity<ConversationEntity> addMembers(
            @PathVariable String conversationId,
            @RequestParam String requesterId,
            @RequestBody List<String> newMemberIds) {
        return ResponseEntity.ok(conversationService.addMembers(conversationId, requesterId, newMemberIds));
    }

    @DeleteMapping("/group/{conversationId}/members/{targetUserId}")
    public ResponseEntity<ConversationEntity> removeMember(
            @PathVariable String conversationId,
            @PathVariable String targetUserId,
            @RequestParam String requesterId) {
        return ResponseEntity.ok(conversationService.removeMember(conversationId, requesterId, targetUserId));
    }
}
