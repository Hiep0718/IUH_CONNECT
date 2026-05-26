package com.iuhconnect.chatservice.controller;

import com.iuhconnect.chatservice.dto.CreateGroupRequest;
import com.iuhconnect.chatservice.dto.GroupSettingsRequest;
import com.iuhconnect.chatservice.model.ConversationEntity;
import com.iuhconnect.chatservice.service.ConversationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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

    @PutMapping("/group/{conversationId}/members/{targetUserId}/role")
    public ResponseEntity<ConversationEntity> assignRole(
            @PathVariable String conversationId,
            @PathVariable String targetUserId,
            @RequestParam String requesterId,
            @RequestParam com.iuhconnect.chatservice.model.GroupRole newRole) {
        return ResponseEntity.ok(conversationService.assignRole(conversationId, requesterId, targetUserId, newRole));
    }

    @PostMapping("/group/{conversationId}/leave-transfer")
    public ResponseEntity<ConversationEntity> leaveAndTransfer(
            @PathVariable String conversationId,
            @RequestParam String requesterId,
            @RequestParam String successorId) {
        return ResponseEntity.ok(conversationService.leaveAndTransfer(conversationId, requesterId, successorId));
    }

    // ======== New Endpoints ========

    // Disband group (ADMIN only)
    @DeleteMapping("/group/{conversationId}")
    public ResponseEntity<Void> disbandGroup(
            @PathVariable String conversationId,
            @RequestParam String requesterId) {
        conversationService.disbandGroup(conversationId, requesterId);
        return ResponseEntity.ok().build();
    }

    // Transfer leadership without leaving
    @PutMapping("/group/{conversationId}/transfer")
    public ResponseEntity<ConversationEntity> transferLeadership(
            @PathVariable String conversationId,
            @RequestParam String requesterId,
            @RequestParam String newAdminId) {
        return ResponseEntity.ok(conversationService.transferLeadership(conversationId, requesterId, newAdminId));
    }

    // Update group settings (approval, invite permissions)
    @PutMapping("/group/{conversationId}/settings")
    public ResponseEntity<ConversationEntity> updateGroupSettings(
            @PathVariable String conversationId,
            @RequestParam String requesterId,
            @RequestBody GroupSettingsRequest settings) {
        return ResponseEntity.ok(conversationService.updateGroupSettings(conversationId, requesterId, settings));
    }

    // Get invite link (for QR code)
    @GetMapping("/group/{conversationId}/invite-link")
    public ResponseEntity<Map<String, String>> getInviteLink(@PathVariable String conversationId) {
        String link = conversationService.getInviteLink(conversationId);
        return ResponseEntity.ok(Map.of("inviteLink", link, "conversationId", conversationId));
    }

    // Join via invite (QR code scan)
    @PostMapping("/group/join/{conversationId}")
    public ResponseEntity<ConversationEntity> joinViaInvite(
            @PathVariable String conversationId,
            @RequestParam String userId) {
        return ResponseEntity.ok(conversationService.joinViaInvite(conversationId, userId));
    }

    // Get pending members
    @GetMapping("/group/{conversationId}/pending")
    public ResponseEntity<ConversationEntity> getPendingMembers(@PathVariable String conversationId) {
        return ResponseEntity.ok(conversationService.getConversation(conversationId));
    }

    // Approve pending member
    @PostMapping("/group/{conversationId}/approve/{userId}")
    public ResponseEntity<ConversationEntity> approveMember(
            @PathVariable String conversationId,
            @PathVariable String userId,
            @RequestParam String requesterId) {
        return ResponseEntity.ok(conversationService.approveMember(conversationId, requesterId, userId));
    }

    // Reject pending member
    @DeleteMapping("/group/{conversationId}/reject/{userId}")
    public ResponseEntity<ConversationEntity> rejectMember(
            @PathVariable String conversationId,
            @PathVariable String userId,
            @RequestParam String requesterId) {
        return ResponseEntity.ok(conversationService.rejectMember(conversationId, requesterId, userId));
    }
}
