package com.iuhconnect.aiservice.dto.ollama;

import lombok.Data;

@Data
public class OllamaGenerateResponse {
    private String model;
    private String response;
    private boolean done;
}
