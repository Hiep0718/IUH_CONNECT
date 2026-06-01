package com.iuhconnect.conversationservice.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Global exception handler for all REST controllers in chat-service.
 * Catches exceptions and returns standardized JSON error responses.
 *
 * Response format:
 * {
 *   "code": "B001",
 *   "message": "Group conversation not found",
 *   "timestamp": 1717084800000
 * }
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Handle custom AppException — returns the appropriate HTTP status and error code.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<Map<String, Object>> handleAppException(AppException ex) {
        ErrorCode errorCode = ex.getErrorCode();

        log.warn("⚠️ AppException [code={}, message={}]", errorCode.getCode(), ex.getMessage());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", errorCode.getCode());
        body.put("message", ex.getMessage());
        body.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.status(errorCode.getHttpStatus()).body(body);
    }

    /**
     * Catch-all for unexpected RuntimeExceptions — returns 500.
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> handleRuntimeException(RuntimeException ex) {
        log.error("❌ Unexpected RuntimeException: {}", ex.getMessage(), ex);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", ErrorCode.INTERNAL_ERROR.getCode());
        body.put("message", ex.getMessage());
        body.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }

    /**
     * Catch-all for any other exceptions — returns 500.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        log.error("❌ Unhandled exception: {}", ex.getMessage(), ex);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("code", ErrorCode.INTERNAL_ERROR.getCode());
        body.put("message", "An unexpected error occurred");
        body.put("timestamp", System.currentTimeMillis());

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
