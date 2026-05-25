package com.iuhconnect.aiservice.dto.ollama;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OllamaGenerateRequest {
    private String model;
    private String prompt;
    private boolean stream;
}
