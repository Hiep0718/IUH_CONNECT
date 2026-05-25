package com.iuhconnect.aiservice.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatClientService {

    private final RestTemplate restTemplate;

    @Value("${app.ai.chat-service.url:http://chat-service:8082}")
    private String chatServiceUrl;

    @Value("${app.ai.auth-service.url:http://auth-service:8081}")
    private String authServiceUrl;

    public String getConversationContext(String conversationId, int limit) {
        String url = chatServiceUrl + "/api/v1/chat/history/" + conversationId + "?limit=" + limit;
        log.info("Fetching chat history from {}", url);
        try {
            List<Map<String, Object>> messages = restTemplate.getForObject(url, List.class);
            if (messages == null || messages.isEmpty()) {
                return "Không có tin nhắn nào.";
            }

            // Extract unique senderIds
            java.util.Set<String> senderIds = new java.util.HashSet<>();
            for (Map<String, Object> msg : messages) {
                String sender = (String) msg.get("senderId");
                if (sender != null) {
                    senderIds.add(sender);
                }
            }

            // Resolve full names from auth-service
            Map<String, String> nameMap = new java.util.HashMap<>();
            if (!senderIds.isEmpty()) {
                try {
                    String authUrl = authServiceUrl + "/api/v1/users/bulk-names";
                    org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                    headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
                    org.springframework.http.HttpEntity<java.util.List<String>> request = new org.springframework.http.HttpEntity<>(new java.util.ArrayList<>(senderIds), headers);
                    Map<String, String> response = restTemplate.postForObject(authUrl, request, Map.class);
                    if (response != null) {
                        nameMap.putAll(response);
                    }
                } catch (Exception e) {
                    log.error("Failed to fetch bulk names from auth-service: {}", e.getMessage());
                }
            }

            StringBuilder contextBuilder = new StringBuilder();
            // Assuming messages are newest-first, we reverse them to build chronological context
            for (int i = messages.size() - 1; i >= 0; i--) {
                Map<String, Object> msg = messages.get(i);
                String sender = (String) msg.get("senderId");
                String content = (String) msg.get("content");
                
                String senderName = nameMap.getOrDefault(sender, sender);

                // Skip empty messages or stickers
                if (content != null && !content.trim().isEmpty()) {
                    contextBuilder.append("- ").append(senderName).append(": ").append(content).append("\n");
                }
            }
            return contextBuilder.toString();
        } catch (Exception e) {
            log.error("Failed to fetch history for conversation {}: {}", conversationId, e.getMessage());
            return null;
        }
    }
}
