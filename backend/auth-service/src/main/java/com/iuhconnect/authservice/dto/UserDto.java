package com.iuhconnect.authservice.dto;

import com.iuhconnect.authservice.model.Gender;
import com.iuhconnect.authservice.model.LecturerStatus;
import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {
    private Long id;
    private String username;
    private String email;
    private String fullName;
    private String avatarUrl;
    private String phone;
    private String studentId;
    private String lecturerId;
    private String department;
    private String bio;
    private String role;
    private LecturerStatus lecturerStatus;
    private Gender gender;
    private String address;
    private LocalDate dateOfBirth;
}
