package com.iuhconnect.authservice.controller;

import com.iuhconnect.authservice.dto.ContactDto;
import com.iuhconnect.authservice.service.ContactService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication.getName();
    }

    @PostMapping("/request")
    public ResponseEntity<?> sendRequest(@RequestParam String targetUsername) {
        try {
            contactService.sendFriendRequest(getCurrentUsername(), targetUsername);
            return ResponseEntity.ok().body("Friend request sent");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/accept")
    public ResponseEntity<?> acceptRequest(@RequestParam String senderUsername) {
        try {
            contactService.acceptFriendRequest(getCurrentUsername(), senderUsername);
            return ResponseEntity.ok().body("Friend request accepted");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/pending")
    public ResponseEntity<List<ContactDto>> getPendingRequests() {
        return ResponseEntity.ok(contactService.getPendingRequests(getCurrentUsername()));
    }

    @GetMapping("/list")
    public ResponseEntity<List<ContactDto>> getAcceptedFriends() {
        return ResponseEntity.ok(contactService.getAcceptedFriends(getCurrentUsername()));
    }
}
