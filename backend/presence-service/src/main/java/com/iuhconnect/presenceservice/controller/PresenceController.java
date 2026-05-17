package com.iuhconnect.presenceservice.controller;

import com.iuhconnect.presenceservice.dto.PresenceInfo;
import com.iuhconnect.presenceservice.service.PresenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/presence")
public class PresenceController {

    private final PresenceService presenceService;

    public PresenceController(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    /**
     * Get presence status of a single user.
     */
    @GetMapping("/{userId}")
    public ResponseEntity<PresenceInfo> getPresence(@PathVariable String userId) {
        return ResponseEntity.ok(presenceService.getPresence(userId));
    }

    /**
     * Get presence status of multiple users at once.
     * Body: ["user1", "user2", "user3"]
     */
    @PostMapping("/bulk")
    public ResponseEntity<Map<String, PresenceInfo>> getBulkPresence(@RequestBody List<String> userIds) {
        return ResponseEntity.ok(presenceService.getBulkPresence(userIds));
    }

    /**
     * Health check endpoint for presence-service.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "service", "presence-service",
                "status", "UP"
        ));
    }
}
