package com.iuhconnect.notificationservice.service;

import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.iuhconnect.notificationservice.cache.LocalCacheService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class FcmPushService {

    private static final Logger log = LoggerFactory.getLogger(FcmPushService.class);
    private final LocalCacheService localCacheService;

    public FcmPushService(LocalCacheService localCacheService) {
        this.localCacheService = localCacheService;
    }

    public void sendPushNotification(String userId, String title, String body, Map<String, String> data) {
        String token = localCacheService.getToken(userId);
        if (token == null) {
            log.warn("⚠️ Cannot send push to user {}: No FCM token in cache", userId);
            return;
        }

        try {
            Message.Builder messageBuilder = Message.builder()
                    .setToken(token);

            boolean isCall = "CALL_INVITE".equals(data.get("type"));
            String channelId = isCall ? "call_channel" : "default_channel";

            messageBuilder.setNotification(Notification.builder()
                            .setTitle(title)
                            .setBody(body)
                            .build())
                    .setAndroidConfig(AndroidConfig.builder()
                            .setPriority(AndroidConfig.Priority.HIGH)
                            .setNotification(AndroidNotification.builder()
                                    .setColor("#0056D2")
                                    .setSound("default")
                                    .setIcon("ic_notification")
                                    .setChannelId(channelId) // Sử dụng custom channel
                                    .build())
                            .build())
                    .setApnsConfig(ApnsConfig.builder()
                            .setAps(Aps.builder()
                                    .setSound("default")
                                    .build())
                            .build());

            if (data != null && !data.isEmpty()) {
                messageBuilder.putAllData(data);
            }

            String response = FirebaseMessaging.getInstance().send(messageBuilder.build());
            log.info("✅ Sent push notification to user {}: {}", userId, response);
            
        } catch (Exception e) {
            log.error("❌ Failed to send push to user {}: {}", userId, e.getMessage());
            // Có thể thêm logic xóa token khỏi cache nếu lỗi là do token hết hạn (NotRegistered)
            if (e.getMessage() != null && e.getMessage().contains("registration-token-not-registered")) {
                localCacheService.removeToken(userId);
                log.info("Removed invalid token for user {}", userId);
            }
        }
    }
}
