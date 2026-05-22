package com.iuhconnect.chatservice.exception;

/**
 * Standardized Error Codes for IUH Connect.
 * Mỗi error code có format: "EXXX" (E + HTTP status code tương ứng).
 * Sử dụng thống nhất trên toàn hệ thống để dễ debug và maintain.
 */
public enum ErrorCode {

    // ── Success ──
    SUCCESS("S000", "Success"),

    // ── Client Errors (4xx) ──
    BAD_REQUEST("E400", "Bad request"),
    UNAUTHORIZED("E401", "Unauthorized — invalid or expired token"),
    FORBIDDEN("E403", "Forbidden — insufficient permissions"),
    NOT_FOUND("E404", "Resource not found"),
    CONFLICT("E409", "Resource conflict"),
    RATE_LIMITED("E429", "Too many requests — rate limit exceeded"),

    // ── Server Errors (5xx) ──
    INTERNAL_ERROR("E500", "Internal server error"),
    SERVICE_UNAVAILABLE("E503", "Service temporarily unavailable"),

    // ── Business Errors ──
    GROUP_NOT_FOUND("B001", "Group conversation not found"),
    NOT_GROUP_CONVERSATION("B002", "Operation only available for group conversations"),
    INSUFFICIENT_ROLE("B003", "Insufficient role for this operation"),
    USER_NOT_IN_GROUP("B004", "User is not a member of this group"),
    ADMIN_MUST_TRANSFER("B005", "Admin must transfer leadership before leaving");

    private final String code;
    private final String message;

    ErrorCode(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    @Override
    public String toString() {
        return code + " — " + message;
    }
}
