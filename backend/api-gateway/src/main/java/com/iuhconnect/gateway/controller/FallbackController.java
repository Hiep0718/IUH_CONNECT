package com.iuhconnect.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import java.util.Map;

@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @RequestMapping("/auth")
    public Mono<ResponseEntity<Map<String, String>>> authServiceFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("message", "Auth Service is currently unavailable. Please try again later.")));
    }

    @RequestMapping("/chat")
    public Mono<ResponseEntity<Map<String, String>>> chatServiceFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("message", "Chat Service is currently unavailable. Please try again later.")));
    }

    @RequestMapping("/presence")
    public Mono<ResponseEntity<Map<String, String>>> presenceServiceFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("message", "Presence Service is currently unavailable. Please try again later.")));
    }

    @RequestMapping("/ai")
    public Mono<ResponseEntity<Map<String, String>>> aiServiceFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("message", "AI Service is currently unavailable or initializing. Please try again later.")));
    }
}
