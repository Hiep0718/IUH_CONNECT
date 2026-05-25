package com.iuhconnect.aiservice.client;

import com.iuhconnect.aiservice.dto.ollama.OllamaGenerateRequest;
import com.iuhconnect.aiservice.dto.ollama.OllamaGenerateResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class OllamaClientService {

    private final RestTemplate restTemplate;

    @Value("${app.ai.ollama.url}")
    private String ollamaUrl;

    @Value("${app.ai.ollama.model}")
    private String ollamaModel;

    @CircuitBreaker(name = "ollamaCircuitBreaker", fallbackMethod = "fallbackGenerate")
    public String generateAnswer(String prompt) {
        String url = ollamaUrl + "/api/generate";
        
        // stream = false to get the full response at once for simplicity in REST.
        // For production, we can switch to WebClient and stream = true to use SSE.
        OllamaGenerateRequest request = new OllamaGenerateRequest(ollamaModel, prompt, false);
        
        log.info("Sending request to Ollama at {}: {}", url, prompt);
        OllamaGenerateResponse response = restTemplate.postForObject(url, request, OllamaGenerateResponse.class);
        
        if (response != null && response.getResponse() != null) {
            return response.getResponse();
        }
        return "Xin lỗi, hiện tại tôi không thể trả lời. (Lỗi xử lý dữ liệu từ Ollama)";
    }

    public String fallbackGenerate(String prompt, Throwable t) {
        log.error("Ollama connection failed. Circuit Breaker triggered. Error: {}", t.getMessage());
        return "Xin lỗi, hệ thống AI hiện đang bảo trì hoặc mất kết nối mạng LAN tới máy chủ vật lý. Vui lòng thử lại sau.";
    }

    public List<Double> generateEmbedding(String prompt) {
        String url = ollamaUrl + "/api/embeddings";
        // Default embedding model, usually nomic-embed-text
        Map<String, Object> request = Map.of(
                "model", "nomic-embed-text",
                "prompt", prompt
        );
        log.info("Generating embedding for text: {}", prompt.substring(0, Math.min(prompt.length(), 50)));
        try {
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
            if (response != null && response.containsKey("embedding")) {
                return (List<Double>) response.get("embedding");
            }
        } catch (Exception e) {
            log.error("Failed to generate embedding: {}", e.getMessage());
        }
        return null;
    }
}
