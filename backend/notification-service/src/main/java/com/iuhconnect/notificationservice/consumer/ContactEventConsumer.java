package com.iuhconnect.notificationservice.consumer;

import com.iuhconnect.notificationservice.cache.LocalCacheService;
import com.iuhconnect.notificationservice.dto.ContactEventDto;
import com.iuhconnect.notificationservice.service.FcmPushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * Consumes contact events from Kafka and sends FCM push notifications
 * to offline users when they receive a friend request or acceptance.
 */
@Component
public class ContactEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(ContactEventConsumer.class);
    private final LocalCacheService localCacheService;
    private final FcmPushService fcmPushService;

    public ContactEventConsumer(LocalCacheService localCacheService, FcmPushService fcmPushService) {
        this.localCacheService = localCacheService;
        this.fcmPushService = fcmPushService;
    }

    @KafkaListener(topics = "contact-events", groupId = "notification-service-contact-group")
    public void consumeContactEvent(ContactEventDto event) {
        if (event == null || event.getReceiverUsername() == null) return;

        String receiverUsername = event.getReceiverUsername();

        // 1. Check if receiver is online — if yes, WebSocket will handle it, skip push
        if (localCacheService.isOnline(receiverUsername)) {
            log.info("⏩ User {} is ONLINE, skipping push notification for contact event.", receiverUsername);
            return;
        }

        // 2. Check if receiver has FCM token
        String token = localCacheService.getToken(receiverUsername);
        if (token == null) {
            log.info("⏩ User {} is OFFLINE but has no FCM token, skipping contact push.", receiverUsername);
            return;
        }

        // 3. Build notification content based on event type
        String title;
        String body;

        if ("FRIEND_REQUEST_SENT".equals(event.getEventType())) {
            title = "Lời mời kết bạn mới";
            body = event.getSenderFullName() + " đã gửi lời mời kết bạn cho bạn";
        } else if ("FRIEND_REQUEST_ACCEPTED".equals(event.getEventType())) {
            title = "Lời mời kết bạn đã được chấp nhận";
            body = event.getSenderFullName() + " đã chấp nhận lời mời kết bạn của bạn";
        } else {
            log.warn("Unknown contact event type: {}", event.getEventType());
            return;
        }

        // 4. Prepare data payload for app navigation
        Map<String, String> data = new HashMap<>();
        data.put("type", "CONTACT_EVENT");
        data.put("eventType", event.getEventType());
        data.put("senderUsername", event.getSenderUsername());
        data.put("senderFullName", event.getSenderFullName());

        // 5. Send push notification
        log.info("📲 Sending contact push notification to {} (OFFLINE) [type={}]",
                receiverUsername, event.getEventType());
        fcmPushService.sendPushNotification(receiverUsername, title, body, data);
    }
}
