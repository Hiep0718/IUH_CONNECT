package com.iuhconnect.gateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import java.util.Map;

@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @RequestMapping("/auth")
    public Mono<ResponseEntity<Map<String, Object>>> authServiceFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "errorCode", "SERVICE_UNAVAILABLE",
                        "message", "Auth Service is currently unavailable. Please try again later.",
                        "status", 503
                )));
    }

    @RequestMapping("/chat")
    public Mono<ResponseEntity<Map<String, Object>>> chatServiceFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "errorCode", "SERVICE_UNAVAILABLE",
                        "message", "Chat Service is currently unavailable. Please try again later.",
                        "status", 503
                )));
    }

    @RequestMapping("/presence")
    public Mono<ResponseEntity<Map<String, Object>>> presenceServiceFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "errorCode", "SERVICE_UNAVAILABLE",
                        "message", "Presence Service is currently unavailable. Please try again later.",
                        "status", 503
                )));
    }

    @RequestMapping("/ai")
    public Mono<ResponseEntity<Map<String, Object>>> aiServiceFallback() {
        return Mono.just(ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of(
                        "errorCode", "SERVICE_UNAVAILABLE",
                        "message", "AI Service is currently unavailable or initializing. Please try again later.",
                        "status", 503
                )));
    }
}
