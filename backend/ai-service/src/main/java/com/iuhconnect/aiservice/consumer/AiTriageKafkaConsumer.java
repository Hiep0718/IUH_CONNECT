package com.iuhconnect.aiservice.consumer;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iuhconnect.aiservice.client.OllamaClientService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AiTriageKafkaConsumer {

    private final ObjectMapper objectMapper;
    private final OllamaClientService ollamaClientService;

    @KafkaListener(topics = "chat-messages", groupId = "ai-triage-group")
    public void consumeMessage(String messagePayload) {
        try {
            Map<String, Object> message = objectMapper.readValue(messagePayload, new TypeReference<>() {});
            String content = (String) message.get("content");
            String senderId = (String) message.get("senderId");
            String messageType = (String) message.get("messageType");

            // Filter logic: ignore empty, short, or system messages
            if (content == null || content.trim().isEmpty()) return;
            if ("AUTO_REPLY".equals(messageType) || "SYSTEM".equals(messageType)) return;

            String lowerContent = content.toLowerCase();
            int wordCount = content.split("\\s+").length;

            // Step 1: Rule-based hard filter
            boolean isUrgent = wordCount > 20 || 
                               lowerContent.contains("deadline") || 
                               lowerContent.contains("thông báo") || 
                               lowerContent.contains("thong bao") || 
                               lowerContent.contains("nghỉ học") || 
                               lowerContent.contains("nghi hoc") || 
                               lowerContent.contains("đổi phòng") || 
                               lowerContent.contains("doi phong") || 
                               lowerContent.contains("@all");

            if (!isUrgent) {
                // Drop the message silently to save AI resources
                return;
            }

            log.info("Message caught by Rule-based filter: '{}' (Sender: {})", content.substring(0, Math.min(50, content.length())), senderId);

            // Step 2: AI Evaluation
            String prompt = "Đánh giá mức độ quan trọng (chỉ trả lời một chữ 'HIGH' hoặc 'LOW') của tin nhắn nhóm lớp sau. Các thông báo từ giáo viên, nhắc nhở deadline, báo đổi phòng hoặc nghỉ học là HIGH. Các tin nhắn chat chit bình thường, nói chuyện riêng là LOW. Nội dung tin nhắn: \"" + content + "\"";
            
            String aiAssessment = ollamaClientService.generateAnswer(prompt);
            
            if (aiAssessment != null && aiAssessment.contains("HIGH")) {
                log.info("🔔 AI Triage Result: [HIGH URGENCY] for message by {}", senderId);
                // Here we would push an event to Kafka 'notifications' topic to trigger a high-priority push notification.
                // For MVP Phase 4, we just log it as a proof of concept.
            } else {
                log.info("🔕 AI Triage Result: [LOW URGENCY] for message by {}", senderId);
            }

        } catch (Exception e) {
            log.error("Failed to parse or process Kafka message for AI triage: {}", e.getMessage());
        }
    }
}
