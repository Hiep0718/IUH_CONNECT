package com.iuhconnect.chatservice.service;

import com.iuhconnect.chatservice.dto.CreateGroupRequest;
import com.iuhconnect.chatservice.model.ConversationEntity;
import com.iuhconnect.chatservice.model.ConversationType;
import com.iuhconnect.chatservice.model.GroupMember;
import com.iuhconnect.chatservice.model.GroupRole;
import com.iuhconnect.chatservice.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;

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

    public ConversationEntity getConversation(String conversationId) {
        return conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));
    }

    public ConversationEntity updateGroupName(String conversationId, String requesterId, String newName) {
        ConversationEntity group = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        if (group.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Not a group conversation");
        }

        boolean isAdmin = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(requesterId) && m.getRole() == GroupRole.ADMIN);
        
        if (!isAdmin) {
            throw new RuntimeException("Only ADMIN can update group name");
        }

        group.setName(newName);
        group.setUpdatedAt(System.currentTimeMillis());
        return conversationRepository.save(group);
    }

    public ConversationEntity addMembers(String conversationId, String requesterId, List<String> newMemberIds) {
        ConversationEntity group = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        if (group.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Not a group conversation");
        }

        boolean isAdmin = group.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(requesterId) && m.getRole() == GroupRole.ADMIN);
        
        if (!isAdmin) {
            throw new RuntimeException("Only ADMIN can add members");
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
        return conversationRepository.save(group);
    }

    public ConversationEntity removeMember(String conversationId, String requesterId, String targetUserId) {
        ConversationEntity group = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Group not found"));

        if (group.getType() != ConversationType.GROUP) {
            throw new RuntimeException("Not a group conversation");
        }

        boolean isSelfLeave = requesterId.equals(targetUserId);

        // If not self leaving, check if requester is ADMIN
        if (!isSelfLeave) {
            boolean isAdmin = group.getMembers().stream()
                    .anyMatch(m -> m.getUserId().equals(requesterId) && m.getRole() == GroupRole.ADMIN);
            if (!isAdmin) {
                throw new RuntimeException("Only ADMIN can remove members");
            }
        }

        boolean removed = group.getMembers().removeIf(m -> m.getUserId().equals(targetUserId));
        if (!removed) {
            throw new RuntimeException("User is not a member of this group");
        }

        // Handle case where the last ADMIN leaves
        if (isSelfLeave) {
            long adminCount = group.getMembers().stream().filter(m -> m.getRole() == GroupRole.ADMIN).count();
            if (adminCount == 0 && !group.getMembers().isEmpty()) {
                // Promote the oldest member to ADMIN
                group.getMembers().get(0).setRole(GroupRole.ADMIN);
            }
        }

        group.setUpdatedAt(System.currentTimeMillis());
        return conversationRepository.save(group);
    }
}
