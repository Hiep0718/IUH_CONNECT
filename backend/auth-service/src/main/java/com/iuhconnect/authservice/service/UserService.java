package com.iuhconnect.authservice.service;

import com.iuhconnect.authservice.dto.UpdateUserRequest;
import com.iuhconnect.authservice.dto.UserDto;
import com.iuhconnect.authservice.model.User;
import com.iuhconnect.authservice.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserEventProducer userEventProducer;

    public UserService(UserRepository userRepository, UserEventProducer userEventProducer) {
        this.userRepository = userRepository;
        this.userEventProducer = userEventProducer;
    }

    public UserDto getCurrentUserProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return mapToDto(user);
    }

    public java.util.Map<String, String> getBulkNames(java.util.List<String> usernames) {
        java.util.Map<String, String> map = new java.util.HashMap<>();
        userRepository.findByUsernameIn(usernames).forEach(u -> {
            String name = (u.getFullName() != null && !u.getFullName().trim().isEmpty()) ? u.getFullName() : u.getUsername();
            map.put(u.getUsername(), name);
        });
        return map;
    }

    public UserDto updateUserProfile(String username, UpdateUserRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getPhone() != null) user.setPhone(request.getPhone());
        if (request.getDepartment() != null) user.setDepartment(request.getDepartment());
        if (request.getBio() != null) user.setBio(request.getBio());
        if (request.getLecturerStatus() != null) {
            if (user.getRole() != com.iuhconnect.authservice.model.Role.LECTURER) {
                throw new IllegalArgumentException("Chỉ giảng viên mới có thể thay đổi trạng thái tư vấn");
            }
            user.setLecturerStatus(request.getLecturerStatus());
        }
        if (request.getGender() != null) user.setGender(request.getGender());
        if (request.getAddress() != null) user.setAddress(request.getAddress());
        if (request.getDateOfBirth() != null) user.setDateOfBirth(request.getDateOfBirth());
        if (request.getStudentId() != null && user.getRole() == com.iuhconnect.authservice.model.Role.STUDENT) {
            user.setStudentId(request.getStudentId());
        }
        if (request.getLecturerId() != null && user.getRole() == com.iuhconnect.authservice.model.Role.LECTURER) {
            user.setLecturerId(request.getLecturerId());
        }

        User updatedUser = userRepository.save(user);
        return mapToDto(updatedUser);
    }

    public void updateFcmToken(String username, String fcmToken) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setFcmToken(fcmToken);
        userRepository.save(user);

        // Publish event for Notification Service
        com.iuhconnect.authservice.dto.UserEventDto event = com.iuhconnect.authservice.dto.UserEventDto.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .eventType("FCM_TOKEN_UPDATED")
                .fcmToken(fcmToken)
                .build();
        userEventProducer.publishUserCreatedEvent(event);
    }

    private UserDto mapToDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .phone(user.getPhone())
                .studentId(user.getStudentId())
                .lecturerId(user.getLecturerId())
                .department(user.getDepartment())
                .bio(user.getBio())
                .role(user.getRole() != null ? user.getRole().name() : null)
                .lecturerStatus(user.getLecturerStatus())
                .gender(user.getGender())
                .address(user.getAddress())
                .dateOfBirth(user.getDateOfBirth())
                .build();
    }
}
