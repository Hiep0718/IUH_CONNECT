package com.iuhconnect.authservice.service;

import com.iuhconnect.authservice.dto.*;
import com.iuhconnect.authservice.model.User;
import com.iuhconnect.authservice.repository.UserRepository;
import com.iuhconnect.authservice.security.JwtTokenProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserEventProducer userEventProducer;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider,
                       UserEventProducer userEventProducer) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
        this.userEventProducer = userEventProducer;
    }

    // -------------------- Login --------------------

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new BadCredentialsException("Invalid username or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid username or password");
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user.getUsername(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getUsername());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();
    }

    // -------------------- Register --------------------

    public AuthResponse register(RegisterRequest request) {
        // 1. Check if username already exists
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new IllegalArgumentException("Username '" + request.getUsername() + "' already exists");
        }

        // 2. Determine role
        com.iuhconnect.authservice.model.Role userRole = com.iuhconnect.authservice.model.Role.STUDENT;
        if (request.getRole() != null && request.getRole().equalsIgnoreCase("LECTURER")) {
            userRole = com.iuhconnect.authservice.model.Role.LECTURER;
            if (request.getLecturerId() == null || request.getLecturerId().isBlank()) {
                throw new IllegalArgumentException("Mã giảng viên là bắt buộc cho tài khoản Giảng viên");
            }
        } else {
            if (request.getStudentId() == null || request.getStudentId().isBlank()) {
                throw new IllegalArgumentException("MSSV là bắt buộc cho tài khoản Sinh viên");
            }
        }

        // 3. Hash password and save user to MariaDB
        User user = User.builder()
                .username(request.getUsername())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .avatarUrl(request.getAvatarUrl())
                .email(request.getEmail())
                .fullName(request.getFullName() != null && !request.getFullName().isBlank() 
                          ? request.getFullName() : request.getUsername())
                .role(userRole)
                .studentId(request.getStudentId())
                .lecturerId(request.getLecturerId())
                .department(request.getDepartment())
                .build();

        User savedUser = userRepository.save(user);

        // 3. Publish event to Kafka topic "user-events"
        UserEventDto event = UserEventDto.builder()
                .userId(savedUser.getId())
                .username(savedUser.getUsername())
                .avatarUrl(savedUser.getAvatarUrl())
                .build();

        userEventProducer.publishUserCreatedEvent(event);

        // 4. Generate tokens and return
        String accessToken = jwtTokenProvider.generateAccessToken(savedUser.getUsername(), savedUser.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(savedUser.getUsername());

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .build();
    }
}
