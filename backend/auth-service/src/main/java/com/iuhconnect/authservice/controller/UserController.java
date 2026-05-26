package com.iuhconnect.authservice.controller;

import com.iuhconnect.authservice.dto.UpdateUserRequest;
import com.iuhconnect.authservice.dto.UserDto;
import com.iuhconnect.authservice.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserDto> getCurrentUserProfile(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        UserDto userDto = userService.getCurrentUserProfile(principal.getName());
        return ResponseEntity.ok(userDto);
    }

    @PostMapping("/bulk-names")
    public ResponseEntity<java.util.Map<String, String>> getBulkNames(@RequestBody java.util.List<String> usernames) {
        return ResponseEntity.ok(userService.getBulkNames(usernames));
    }

    @PostMapping("/bulk-profiles")
    public ResponseEntity<java.util.Map<String, UserDto>> getBulkProfiles(@RequestBody java.util.List<String> usernames) {
        return ResponseEntity.ok(userService.getBulkProfiles(usernames));
    }

    @PutMapping("/me")
    public ResponseEntity<UserDto> updateUserProfile(Principal principal, @RequestBody UpdateUserRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        UserDto updatedUser = userService.updateUserProfile(principal.getName(), request);
        return ResponseEntity.ok(updatedUser);
    }

    @PostMapping("/fcm-token")
    public ResponseEntity<Void> updateFcmToken(Principal principal, @RequestBody com.iuhconnect.authservice.dto.FcmTokenRequest request) {
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        userService.updateFcmToken(principal.getName(), request.getFcmToken());
        return ResponseEntity.ok().build();
    }
}
