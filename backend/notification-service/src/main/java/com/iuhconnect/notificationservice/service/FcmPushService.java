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

            if (isCall) {
                // ★ CALL_INVITE: Gửi dạng DATA-ONLY (không có notification block).
                // Lý do: Nếu có notification block, khi app bị background/killed,
                // Android OS tự hiển thị banner nhỏ và KHÔNG gọi JS background handler.
                // Với data-only, JS handler LUÔN được gọi → có thể dùng Notifee
                // để hiển thị full-screen incoming call UI.
                messageBuilder.setAndroidConfig(AndroidConfig.builder()
                                .setPriority(AndroidConfig.Priority.HIGH)
                                .build());

                // Đẩy title/body vào data để frontend tự xử lý hiển thị
                if (data != null) {
                    data.put("title", title);
                    data.put("body", body);
                }
            } else {
                // Tin nhắn thường: Gửi notification + data như bình thường
                String channelId = "default_channel";
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
                                        .setChannelId(channelId)
                                        .build())
                                .build())
                        .setApnsConfig(ApnsConfig.builder()
                                .setAps(Aps.builder()
                                        .setSound("default")
                                        .build())
                                .build());
            }

            if (data != null && !data.isEmpty()) {
                messageBuilder.putAllData(data);
            }

            String response = FirebaseMessaging.getInstance().send(messageBuilder.build());
            log.info("✅ Sent push notification to user {}: {}", userId, response);
            
        } catch (Exception e) {
            log.error("❌ Failed to send push to user {}: {}", userId, e.getMessage());
            if (e.getMessage() != null && e.getMessage().contains("registration-token-not-registered")) {
                localCacheService.removeToken(userId);
                log.info("Removed invalid token for user {}", userId);
            }
        }
    }
}
