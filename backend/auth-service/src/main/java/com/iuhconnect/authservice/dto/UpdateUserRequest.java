package com.iuhconnect.authservice.dto;

import com.iuhconnect.authservice.model.Gender;
import com.iuhconnect.authservice.model.LecturerStatus;
import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateUserRequest {
    private String fullName;
    private String email;
    private String phone;
    private String department;
    private String bio;
    private LecturerStatus lecturerStatus;
    private Gender gender;
    private String address;
    private LocalDate dateOfBirth;
}
