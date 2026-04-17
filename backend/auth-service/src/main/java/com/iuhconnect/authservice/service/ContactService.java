package com.iuhconnect.authservice.service;

import com.iuhconnect.authservice.dto.ContactDto;
import com.iuhconnect.authservice.model.Friendship;
import com.iuhconnect.authservice.model.FriendshipStatus;
import com.iuhconnect.authservice.model.User;
import com.iuhconnect.authservice.repository.FriendshipRepository;
import com.iuhconnect.authservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContactService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;

    @Transactional
    public void sendFriendRequest(String currentUsername, String targetUsername) {
        if (currentUsername.equals(targetUsername)) {
            throw new IllegalArgumentException("Cannot send request to yourself");
        }

        User sender = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + currentUsername));
        User receiver = userRepository.findByUsername(targetUsername)
                .orElseThrow(() -> new IllegalArgumentException("Target user not found: " + targetUsername));

        Optional<Friendship> existing = friendshipRepository.findByUsers(sender, receiver);
        if (existing.isPresent()) {
            throw new IllegalArgumentException("Friendship or request already exists");
        }

        Friendship friendship = Friendship.builder()
                .user1(sender)
                .user2(receiver)
                .status(FriendshipStatus.PENDING)
                .build();
        friendshipRepository.save(friendship);
    }

    @Transactional
    public void acceptFriendRequest(String currentUsername, String senderUsername) {
        User receiver = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new IllegalArgumentException("Sender not found"));

        Friendship friendship = friendshipRepository.findByUsers(sender, receiver)
                .orElseThrow(() -> new IllegalArgumentException("No pending request found"));

        // Ensure current user is the receiver (user2)
        if (!friendship.getUser2().getId().equals(receiver.getId()) || friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new IllegalArgumentException("Cannot accept this request");
        }

        friendship.setStatus(FriendshipStatus.ACCEPTED);
        friendshipRepository.save(friendship);
    }

    public List<ContactDto> getPendingRequests(String currentUsername) {
        User user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Friendship> pendingList = friendshipRepository.findByUser2AndStatus(user, FriendshipStatus.PENDING);
        
        return pendingList.stream().map(f -> {
            User requester = f.getUser1();
            return ContactDto.builder()
                    .username(requester.getUsername())
                    .fullName(requester.getFullName() != null ? requester.getFullName() : requester.getUsername())
                    .avatarUrl(requester.getAvatarUrl())
                    .role(requester.getRole() != null ? requester.getRole().name() : "STUDENT")
                    .status("PENDING")
                    .build();
        }).collect(Collectors.toList());
    }

    public List<ContactDto> getAcceptedFriends(String currentUsername) {
        User user = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Friendship> friendships = friendshipRepository.findAllUserFriendships(user, FriendshipStatus.ACCEPTED);

        return friendships.stream().map(f -> {
            User friend = f.getUser1().getId().equals(user.getId()) ? f.getUser2() : f.getUser1();
            return ContactDto.builder()
                    .username(friend.getUsername())
                    .fullName(friend.getFullName() != null ? friend.getFullName() : friend.getUsername())
                    .avatarUrl(friend.getAvatarUrl())
                    .role(friend.getRole() != null ? friend.getRole().name() : "STUDENT")
                    .status("ACCEPTED")
                    .build();
        }).collect(Collectors.toList());
    }
}
