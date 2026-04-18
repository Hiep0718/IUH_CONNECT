package com.iuhconnect.authservice.service;

import com.iuhconnect.authservice.dto.UpdateUserRequest;
import com.iuhconnect.authservice.dto.UserDto;
import com.iuhconnect.authservice.model.User;
import com.iuhconnect.authservice.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserDto getCurrentUserProfile(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return mapToDto(user);
    }

    public UserDto updateUserProfile(String username, UpdateUserRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getPhone() != null) user.setPhone(request.getPhone());
        if (request.getDepartment() != null) user.setDepartment(request.getDepartment());
        if (request.getBio() != null) user.setBio(request.getBio());
        if (request.getLecturerStatus() != null) user.setLecturerStatus(request.getLecturerStatus());
        if (request.getGender() != null) user.setGender(request.getGender());
        if (request.getAddress() != null) user.setAddress(request.getAddress());
        if (request.getDateOfBirth() != null) user.setDateOfBirth(request.getDateOfBirth());

        User updatedUser = userRepository.save(user);
        return mapToDto(updatedUser);
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
