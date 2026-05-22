package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.dto.CreateGroupRequest;
import com.iuhconnect.chatservice.model.ConversationEntity;
import com.iuhconnect.chatservice.model.ConversationType;
import com.iuhconnect.chatservice.model.GroupMember;
import com.iuhconnect.chatservice.model.GroupRole;
import com.iuhconnect.chatservice.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.context.annotation.Lazy;

import java.util.ArrayList;
import java.util.List;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final RealtimeEventService realtimeEventService;

    public ConversationService(ConversationRepository conversationRepository, @Lazy RealtimeEventService realtimeEventService) {
        this.conversationRepository = conversationRepository;
        this.realtimeEventService = realtimeEventService;
    }

    private void broadcastGroupUpdate(ConversationEntity group) {
        for (GroupMember member : group.getMembers()) {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("type", "GROUP_UPDATED");
            payload.put("conversation", group);
            realtimeEventService.sendToUser(member.getUserId(), payload);
        }
    }

    public ConversationEntity createGroup(CreateGroupRequest request) {
        long now = System.currentTimeMillis();
        String creatorId = request.getCreatorId();
        
        List<GroupMember> members = new ArrayList<>();
        members.add(GroupMember.builder()
                .userId(creatorId)
                .role(GroupRole.ADMIN)
                .joinedAt(now)
                .build());
        
        if (request.getMemberIds() != null) {
            for (String memberId : request.getMemberIds()) {
                if (!memberId.equals(creatorId)) {
                    members.add(GroupMember.builder()
                            .userId(memberId)
                            .role(GroupRole.MEMBER)
                            .joinedAt(now)
                            .build());
                }
            }
        }

        ConversationEntity group = ConversationEntity.builder()
                .name(request.getName())
                .type(ConversationType.GROUP)
                .creatorId(creatorId)
                .members(members)
                .createdAt(now)
                .updatedAt(now)
                .build();

        return conversationRepository.save(group);
    }

    public List<ConversationEntity> getUserConversations(String userId) {
        return conversationRepository.findByMembersUserId(userId);
    }

    @Cacheable(value = "conversations", key = "#conversationId")
    public ConversationEntity getConversation(String conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));
    }

    @CacheEvict(value = "conversations", key = "#conversationId")
    public ConversationEntity updateGroupName(String conversationId, String requesterId, String newName) {
        ConversationEntity group = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        if (group.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Not a group conversation");
        }

        boolean hasPrivilege = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(requesterId) && (m.getRole() == GroupRole.ADMIN || m.getRole() == GroupRole.DEPUTY));
        
        if (!hasPrivilege) {
            throw new RuntimeException("Only ADMIN or DEPUTY can update group name");
        }

        group.setName(newName);
        group.setUpdatedAt(System.currentTimeMillis());
        ConversationEntity saved = conversationRepository.save(group);
        broadcastGroupUpdate(saved);
        return saved;
    }

    @CacheEvict(value = "conversations", key = "#conversationId")
    public ConversationEntity addMembers(String conversationId, String requesterId, List<String> newMemberIds) {
        ConversationEntity group = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        if (group.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Not a group conversation");
        }

        boolean hasPrivilege = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(requesterId) && (m.getRole() == GroupRole.ADMIN || m.getRole() == GroupRole.DEPUTY));
        
        if (!hasPrivilege) {
            throw new RuntimeException("Only ADMIN or DEPUTY can add members");
        }

        long now = System.currentTimeMillis();
        for (String memberId : newMemberIds) {
            boolean exists = group.getMembers().stream().anyMatch(m -> m.getUserId().equals(memberId));
            if (!exists) {
                group.getMembers().add(GroupMember.builder()
                        .userId(memberId)
                        .role(GroupRole.MEMBER)
                        .joinedAt(now)
                        .build());
            }
        }

        group.setUpdatedAt(now);
        ConversationEntity saved = conversationRepository.save(group);
        broadcastGroupUpdate(saved);
        return saved;
    }

    @CacheEvict(value = "conversations", key = "#conversationId")
    public ConversationEntity removeMember(String conversationId, String requesterId, String targetUserId) {
        ConversationEntity group = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        if (group.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Not a group conversation");
        }

        boolean isSelfLeave = requesterId.equals(targetUserId);

        // If not self leaving, check permissions
        if (!isSelfLeave) {
            GroupMember requesterMember = group.getMembers().stream()
                    .filter(m -> m.getUserId().equals(requesterId))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Requester is not in the group"));
                    
            GroupMember targetMemberObj = group.getMembers().stream()
                    .filter(m -> m.getUserId().equals(targetUserId))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Target user is not in the group"));

            if (requesterMember.getRole() == GroupRole.MEMBER) {
                throw new RuntimeException("Only ADMIN or DEPUTY can remove members");
            }
            
            if (requesterMember.getRole() == GroupRole.DEPUTY) {
                if (targetMemberObj.getRole() == GroupRole.ADMIN || targetMemberObj.getRole() == GroupRole.DEPUTY) {
                    throw new RuntimeException("DEPUTY can only remove MEMBERs");
                }
            }
        }

        // If ADMIN is leaving, check if there's a successor
        if (isSelfLeave) {
            GroupMember leavingMember = group.getMembers().stream()
                    .filter(m -> m.getUserId().equals(requesterId))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Requester is not in the group"));

            if (leavingMember.getRole() == GroupRole.ADMIN && group.getMembers().size() > 1) {
                // Check if there is a deputy to auto-promote
                boolean hasDeputy = group.getMembers().stream()
                        .anyMatch(m -> m.getRole() == GroupRole.DEPUTY);
                if (!hasDeputy) {
                    throw new RuntimeException("ADMIN_MUST_TRANSFER");
                }
            }
        }

        boolean removed = group.getMembers().removeIf(m -> m.getUserId().equals(targetUserId));
        if (!removed) {
            throw new RuntimeException("User is not a member of this group");
        }

        // Handle case where the last ADMIN leaves (auto-promote deputy)
        if (isSelfLeave) {
            long adminCount = group.getMembers().stream().filter(m -> m.getRole() == GroupRole.ADMIN).count();
            if (adminCount == 0 && !group.getMembers().isEmpty()) {
                GroupMember nextAdmin = group.getMembers().stream()
                        .filter(m -> m.getRole() == GroupRole.DEPUTY)
                        .findFirst()
                        .orElse(group.getMembers().get(0));
                nextAdmin.setRole(GroupRole.ADMIN);
            }
        }

        group.setUpdatedAt(System.currentTimeMillis());
        ConversationEntity saved = conversationRepository.save(group);
        
        // Notify the kicked/left member so they can remove it from their UI
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("type", "GROUP_UPDATED");
        payload.put("conversation", saved);
        realtimeEventService.sendToUser(targetUserId, payload);
        
        broadcastGroupUpdate(saved);
        return saved;
    }

    @CacheEvict(value = "conversations", key = "#conversationId")
    public ConversationEntity leaveAndTransfer(String conversationId, String requesterId, String successorId) {
        ConversationEntity group = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        if (group.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Not a group conversation");
        }

        boolean isAdmin = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(requesterId) && m.getRole() == GroupRole.ADMIN);
        if (!isAdmin) {
            throw new RuntimeException("Only ADMIN can transfer leadership");
        }

        GroupMember successor = group.getMembers().stream()
                .filter(m -> m.getUserId().equals(successorId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Successor is not in the group"));

        // Promote successor to ADMIN
        successor.setRole(GroupRole.ADMIN);

        // Remove the leaving admin
        group.getMembers().removeIf(m -> m.getUserId().equals(requesterId));

        group.setUpdatedAt(System.currentTimeMillis());
        ConversationEntity saved = conversationRepository.save(group);
        
        // Notify the leaving admin
        java.util.Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("type", "GROUP_UPDATED");
        payload.put("conversation", saved);
        realtimeEventService.sendToUser(requesterId, payload);
        
        broadcastGroupUpdate(saved);
        return saved;
    }

    @CacheEvict(value = "conversations", key = "#conversationId")
    public ConversationEntity assignRole(String conversationId, String requesterId, String targetUserId, GroupRole newRole) {
        ConversationEntity group = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        if (group.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Not a group conversation");
        }

        boolean isAdmin = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(requesterId) && m.getRole() == GroupRole.ADMIN);
        
        if (!isAdmin) {
            throw new RuntimeException("Only ADMIN can assign roles");
        }

        GroupMember targetMember = group.getMembers().stream()
                .filter(m -> m.getUserId().equals(targetUserId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Target user is not in the group"));

        targetMember.setRole(newRole);

        group.setUpdatedAt(System.currentTimeMillis());
        ConversationEntity saved = conversationRepository.save(group);
        broadcastGroupUpdate(saved);
        return saved;
    }
}
