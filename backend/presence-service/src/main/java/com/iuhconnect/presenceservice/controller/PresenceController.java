package com.iuhconnect.presenceservice.controller;

import com.iuhconnect.presenceservice.dto.PresenceInfo;
import com.iuhconnect.presenceservice.dto.WorkStatusInfo;
import com.iuhconnect.presenceservice.dto.WorkStatusRequest;
import com.iuhconnect.presenceservice.service.PresenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
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

    // ========== UC10: Work Status Management (LECTURER only) ==========

    /**
     * Set the lecturer's work status (BUSY or AVAILABLE).
     * Requires ROLE_LECTURER (enforced by SecurityConfig).
     */
    @PutMapping("/work-status")
    public ResponseEntity<WorkStatusInfo> setWorkStatus(
            @RequestBody WorkStatusRequest request,
            Principal principal) {

        String userId = principal.getName();
        String status = request.getStatus();

        // Validate status
        if (!"BUSY".equals(status) && !"AVAILABLE".equals(status)) {
            return ResponseEntity.badRequest().build();
        }

        presenceService.setWorkStatus(userId, status, request.getAutoReplyMessage());
        return ResponseEntity.ok(presenceService.getWorkStatusInfo(userId));
    }

    /**
     * Clear the lecturer's work status (back to normal ONLINE).
     * Requires ROLE_LECTURER (enforced by SecurityConfig).
     */
    @DeleteMapping("/work-status")
    public ResponseEntity<Map<String, String>> clearWorkStatus(Principal principal) {
        String userId = principal.getName();
        presenceService.clearWorkStatus(userId);
        return ResponseEntity.ok(Map.of("status", "cleared", "userId", userId));
    }

    /**
     * Get the work status of a specific user (any authenticated user can query).
     */
    @GetMapping("/work-status/{userId}")
    public ResponseEntity<WorkStatusInfo> getWorkStatus(@PathVariable String userId) {
        return ResponseEntity.ok(presenceService.getWorkStatusInfo(userId));
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
