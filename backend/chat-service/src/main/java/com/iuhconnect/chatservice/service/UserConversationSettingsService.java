package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.model.UserConversationSettings;
import com.iuhconnect.chatservice.repository.UserConversationSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserConversationSettingsService {

    private final UserConversationSettingsRepository repository;

    /**
     * Get or create settings for a user-conversation pair
     */
    private UserConversationSettings getOrCreate(String userId, String conversationId) {
        return repository.findByUserIdAndConversationId(userId, conversationId)
                .orElseGet(() -> UserConversationSettings.builder()
                        .userId(userId)
                        .conversationId(conversationId)
                        .updatedAt(System.currentTimeMillis())
                        .build());
    }

    // ── Pin / Unpin ──

    public UserConversationSettings togglePin(String userId, String conversationId) {
        UserConversationSettings settings = getOrCreate(userId, conversationId);
        boolean newState = !settings.isPinned();
        settings.setPinned(newState);
        settings.setPinnedAt(newState ? System.currentTimeMillis() : null);
        settings.setUpdatedAt(System.currentTimeMillis());
        return repository.save(settings);
    }

    // ── Mute / Unmute ──

    public UserConversationSettings toggleMute(String userId, String conversationId, Long mutedUntil) {
        UserConversationSettings settings = getOrCreate(userId, conversationId);
        boolean newState = !settings.isMuted();
        settings.setMuted(newState);
        settings.setMutedUntil(newState ? mutedUntil : null);
        settings.setUpdatedAt(System.currentTimeMillis());
        return repository.save(settings);
    }

    // ── Archive / Unarchive ──

    public UserConversationSettings toggleArchive(String userId, String conversationId) {
        UserConversationSettings settings = getOrCreate(userId, conversationId);
        settings.setArchived(!settings.isArchived());
        settings.setUpdatedAt(System.currentTimeMillis());
        return repository.save(settings);
    }

    // ── Delete conversation (soft delete — hides messages before now) ──

    public UserConversationSettings deleteConversation(String userId, String conversationId) {
        UserConversationSettings settings = getOrCreate(userId, conversationId);
        settings.setDeleted(true);
        settings.setDeletedAt(System.currentTimeMillis());
        settings.setUpdatedAt(System.currentTimeMillis());
        return repository.save(settings);
    }

    // ── Undo delete ──

    public UserConversationSettings restoreConversation(String userId, String conversationId) {
        UserConversationSettings settings = getOrCreate(userId, conversationId);
        settings.setDeleted(false);
        settings.setDeletedAt(null);
        settings.setUpdatedAt(System.currentTimeMillis());
        return repository.save(settings);
    }

    // ── Get user settings for a specific conversation ──

    public UserConversationSettings getSettings(String userId, String conversationId) {
        return repository.findByUserIdAndConversationId(userId, conversationId)
                .orElse(UserConversationSettings.builder()
                        .userId(userId)
                        .conversationId(conversationId)
                        .build());
    }

    // ── Get all settings for a user ──

    public List<UserConversationSettings> getAllSettings(String userId) {
        return repository.findByUserId(userId);
    }

    // ── Get pinned conversations ──

    public List<UserConversationSettings> getPinned(String userId) {
        return repository.findByUserIdAndPinnedTrue(userId);
    }

    // ── Get archived conversations ──

    public List<UserConversationSettings> getArchived(String userId) {
        return repository.findByUserIdAndArchivedTrue(userId);
    }
}
