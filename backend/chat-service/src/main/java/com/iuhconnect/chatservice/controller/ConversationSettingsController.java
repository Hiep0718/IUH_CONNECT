package com.iuhconnect.chatservice.controller;

import com.iuhconnect.chatservice.model.UserConversationSettings;
import com.iuhconnect.chatservice.service.UserConversationSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST API for per-user conversation settings (pin, mute, archive, delete).
 * All endpoints are under /api/v1/chat/settings which routes through api-gateway.
 */
@RestController
@RequestMapping("/api/v1/chat/settings")
@RequiredArgsConstructor
public class ConversationSettingsController {

    private final UserConversationSettingsService settingsService;

    /**
     * GET /api/v1/chat/settings/{userId}
     * Get all conversation settings for a user
     */
    @GetMapping("/{userId}")
    public ResponseEntity<List<UserConversationSettings>> getAllSettings(@PathVariable String userId) {
        return ResponseEntity.ok(settingsService.getAllSettings(userId));
    }

    /**
     * GET /api/v1/chat/settings/{userId}/{conversationId}
     * Get settings for a specific conversation
     */
    @GetMapping("/{userId}/{conversationId}")
    public ResponseEntity<UserConversationSettings> getSettings(
            @PathVariable String userId,
            @PathVariable String conversationId) {
        return ResponseEntity.ok(settingsService.getSettings(userId, conversationId));
    }

    /**
     * PUT /api/v1/chat/settings/{userId}/{conversationId}/pin
     * Toggle pin/unpin a conversation
     */
    @PutMapping("/{userId}/{conversationId}/pin")
    public ResponseEntity<UserConversationSettings> togglePin(
            @PathVariable String userId,
            @PathVariable String conversationId) {
        return ResponseEntity.ok(settingsService.togglePin(userId, conversationId));
    }

    /**
     * PUT /api/v1/chat/settings/{userId}/{conversationId}/mute
     * Toggle mute/unmute a conversation
     * Optional query param: mutedUntil (timestamp) — if omitted, mute forever
     */
    @PutMapping("/{userId}/{conversationId}/mute")
    public ResponseEntity<UserConversationSettings> toggleMute(
            @PathVariable String userId,
            @PathVariable String conversationId,
            @RequestParam(required = false) Long mutedUntil) {
        return ResponseEntity.ok(settingsService.toggleMute(userId, conversationId, mutedUntil));
    }

    /**
     * PUT /api/v1/chat/settings/{userId}/{conversationId}/archive
     * Toggle archive/unarchive a conversation
     */
    @PutMapping("/{userId}/{conversationId}/archive")
    public ResponseEntity<UserConversationSettings> toggleArchive(
            @PathVariable String userId,
            @PathVariable String conversationId) {
        return ResponseEntity.ok(settingsService.toggleArchive(userId, conversationId));
    }

    /**
     * DELETE /api/v1/chat/settings/{userId}/{conversationId}
     * Soft-delete a conversation for a user (hides it from their list)
     */
    @DeleteMapping("/{userId}/{conversationId}")
    public ResponseEntity<UserConversationSettings> deleteConversation(
            @PathVariable String userId,
            @PathVariable String conversationId) {
        return ResponseEntity.ok(settingsService.deleteConversation(userId, conversationId));
    }

    /**
     * PUT /api/v1/chat/settings/{userId}/{conversationId}/restore
     * Restore a previously deleted conversation
     */
    @PutMapping("/{userId}/{conversationId}/restore")
    public ResponseEntity<UserConversationSettings> restoreConversation(
            @PathVariable String userId,
            @PathVariable String conversationId) {
        return ResponseEntity.ok(settingsService.restoreConversation(userId, conversationId));
    }

    /**
     * GET /api/v1/chat/settings/{userId}/pinned
     * Get all pinned conversations for a user
     */
    @GetMapping("/{userId}/pinned")
    public ResponseEntity<List<UserConversationSettings>> getPinned(@PathVariable String userId) {
        return ResponseEntity.ok(settingsService.getPinned(userId));
    }
}
