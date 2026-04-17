package com.iuhconnect.chatservice.controller;

import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final MessageService messageService;

    @GetMapping("/history/{conversationId}")
    public ResponseEntity<List<MessageEntity>> getHistory(@PathVariable String conversationId) {
        return ResponseEntity.ok(messageService.getHistory(conversationId));
    }

    @GetMapping("/conversations/{userId}")
    public ResponseEntity<List<MessageEntity>> getRecentConversations(@PathVariable String userId) {
        return ResponseEntity.ok(messageService.getRecentConversations(userId));
    }
}
