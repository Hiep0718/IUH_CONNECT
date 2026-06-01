package com.iuhconnect.mediaservice.exception;

import org.springframework.http.HttpStatus;

/**
 * Standardized Error Codes for IUH Connect.
 * Mỗi error code có format: "EXXX" (E + HTTP status code tương ứng).
 * Sử dụng thống nhất trên toàn hệ thống để dễ debug và maintain.
 */
public enum ErrorCode {

    // ── Success ──
    SUCCESS("S000", "Success", HttpStatus.OK),

    // ── Client Errors (4xx) ──
    BAD_REQUEST("E400", "Bad request", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED("E401", "Unauthorized — invalid or expired token", HttpStatus.UNAUTHORIZED),
    FORBIDDEN("E403", "Forbidden — insufficient permissions", HttpStatus.FORBIDDEN),
    NOT_FOUND("E404", "Resource not found", HttpStatus.NOT_FOUND),
    CONFLICT("E409", "Resource conflict", HttpStatus.CONFLICT),
    RATE_LIMITED("E429", "Too many requests — rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS),

    // ── Server Errors (5xx) ──
    INTERNAL_ERROR("E500", "Internal server error", HttpStatus.INTERNAL_SERVER_ERROR),
    SERVICE_UNAVAILABLE("E503", "Service temporarily unavailable", HttpStatus.SERVICE_UNAVAILABLE),

    // ── Business Errors ──
    GROUP_NOT_FOUND("B001", "Group conversation not found", HttpStatus.NOT_FOUND),
    NOT_GROUP_CONVERSATION("B002", "Operation only available for group conversations", HttpStatus.BAD_REQUEST),
    INSUFFICIENT_ROLE("B003", "Insufficient role for this operation", HttpStatus.FORBIDDEN),
    USER_NOT_IN_GROUP("B004", "User is not a member of this group", HttpStatus.BAD_REQUEST),
    ADMIN_MUST_TRANSFER("B005", "Admin must transfer leadership before leaving", HttpStatus.BAD_REQUEST),
    MESSAGE_NOT_FOUND("B006", "Message not found", HttpStatus.NOT_FOUND),
    MEMBER_ALREADY_EXISTS("B007", "User is already a member of this group", HttpStatus.CONFLICT),
    INVALID_OPERATION("B008", "Invalid operation", HttpStatus.BAD_REQUEST),
    SUCCESSOR_NOT_IN_GROUP("B009", "Successor is not in the group", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(String code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }

    @Override
    public String toString() {
        return code + " — " + message;
    }
}
