package com.iuhconnect.notificationservice.consumer;

import com.iuhconnect.notificationservice.cache.LocalCacheService;
import com.iuhconnect.notificationservice.dto.ChatMessageDto;
import com.iuhconnect.notificationservice.service.FcmPushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class ChatMessageConsumer {
    private static final Logger log = LoggerFactory.getLogger(ChatMessageConsumer.class);
    private final LocalCacheService localCacheService;
    private final FcmPushService fcmPushService;

    public ChatMessageConsumer(LocalCacheService localCacheService, FcmPushService fcmPushService) {
        this.localCacheService = localCacheService;
        this.fcmPushService = fcmPushService;
    }

    @KafkaListener(topics = "chat-messages", groupId = "notification-service-chat-group")
    public void consumeChatMessage(ChatMessageDto message) {
        if (message == null || message.getReceiverId() == null) return;

        String receiverId = message.getReceiverId();
        
        // 1. Kiểm tra trạng thái Online (Bypass cho CALL_INVITE để đảm bảo luôn gửi thông báo)
        boolean isCallInvite = "CALL_INVITE".equals(message.getMessageType());
        if (!isCallInvite && localCacheService.isOnline(receiverId)) {
            log.info("⏩ User {} is ONLINE, skipping push notification.", receiverId);
            return;
        }

        // 2. Kiểm tra FCM Token
        String token = localCacheService.getToken(receiverId);
        if (token == null) {
            log.info("⏩ User {} is OFFLINE but has no FCM token, skipping.", receiverId);
            return;
        }

        // 3. Chuẩn bị payload và gửi push
        String title = "Bạn có tin nhắn mới";
        String body = "Tin nhắn từ " + message.getSenderId(); // Lý tưởng là query tên user, nhưng trong microservices ta tạm dùng ID hoặc senderName nếu gửi kèm

        // Xử lý content hiển thị
        if ("CALL_INVITE".equals(message.getMessageType())) {
            title = "Cuộc gọi đến";
            body = message.getSenderId() + " đang gọi video cho bạn.";
        } else if ("IMAGE".equals(message.getMessageType())) {
            body = message.getSenderId() + " đã gửi 1 hình ảnh.";
        } else if (message.getContent() != null && !message.getContent().isEmpty()) {
            body = message.getSenderId() + ": " + message.getContent();
        }

        Map<String, String> data = new HashMap<>();
        data.put("conversationId", message.getConversationId());
        
        if ("CALL_INVITE".equals(message.getMessageType())) {
            data.put("type", "CALL_INVITE");
            data.put("senderId", message.getSenderId());
        } else {
            data.put("type", "CHAT_MESSAGE");
        }
        
        log.info("📲 Preparing to send Push to {} (type={})", receiverId, data.get("type"));
        fcmPushService.sendPushNotification(receiverId, title, body, data);
    }
}
