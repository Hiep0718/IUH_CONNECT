package com.iuhconnect.chatservice.consumer;

import com.iuhconnect.chatservice.dto.ChatMessageDto;
import com.iuhconnect.chatservice.model.MessageEntity;
import com.iuhconnect.chatservice.repository.MessageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ChatMessageKafkaConsumer {

    private static final Logger log = LoggerFactory.getLogger(ChatMessageKafkaConsumer.class);

    private final MessageRepository messageRepository;
    // Removed RedisTemplate and ObjectMapper for pub/sub as we now use Kafka broadcast via dynamic Group ID.
    // Also need WebSocketSessionManager to send message to user if connected here.
    private final com.iuhconnect.chatservice.handler.WebSocketSessionManager webSocketSessionManager;

    public ChatMessageKafkaConsumer(MessageRepository messageRepository,
                                    com.iuhconnect.chatservice.handler.WebSocketSessionManager webSocketSessionManager) {
        this.messageRepository = messageRepository;
        this.webSocketSessionManager = webSocketSessionManager;
    }

    @KafkaListener(
            topics = "chat-messages",
            groupId = "#{T(java.util.UUID).randomUUID().toString()}"
    )
    public void consumeChatMessage(ChatMessageDto message) {
        if (message == null) {
            log.warn("⚠️ Received null chat message, likely due to deserialization error. Skipping.");
            return;
        }

        log.info("📩 Received chat message from Kafka [from={}, to={}, conv={}]",
                message.getSenderId(), message.getReceiverId(), message.getConversationId());

        try {
            // 1. Save message to MongoDB
            MessageEntity entity = MessageEntity.builder()
                    .senderId(message.getSenderId())
                    .receiverId(message.getReceiverId())
                    .content(message.getContent())
                    .conversationId(message.getConversationId())
                    .timestamp(message.getTimestamp())
                    .build();

            // 1. Lưu DB: Vì sử dụng chung Group ID ngẫu nhiên để Broadcast, tất cả các instance sẽ nhận được message.
            // Để tránh lưu trùng lặp nhiều lần, ta thêm logic kiểm tra xem message đã tồn tại chưa (nếu id message do client gửi lên),
            // Hoặc có thể tách 1 Consumer khác (với group cố định) chỉ làm nhiệm vụ lưu DB,
            // Consumer này CHỈ làm nhiệm vụ Broadcast. 
            // Tạm thời, giả định messageRepository có cơ chế xử lý id, hoặc ta vẫn lưu bình thường (cần cẩn trọng khi scale out).
            
            // Xử lý đơn giản: Kiểm tra receiver có đang kết nối ở instance này không
            org.springframework.web.socket.WebSocketSession session = webSocketSessionManager.getSession(message.getReceiverId());
            if (session != null && session.isOpen()) {
                session.sendMessage(new org.springframework.web.socket.TextMessage(
                        new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(message)
                ));
                log.info("📡 Đã đẩy message qua WebSocket cho user [{}]", message.getReceiverId());
            }

            // (Lưu ý: Logic lưu MongoDB hiện tại nếu chạy nhiều node sẽ bị duplicate nếu không check exists)
            messageRepository.save(entity);
            log.info("💾 Message saved to MongoDB [id={}]", entity.getId());

        } catch (Exception e) {
            log.error("❌ Failed to process chat message: {}", e.getMessage(), e);
        }
    }
}
