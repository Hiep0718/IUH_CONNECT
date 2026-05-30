package com.iuhconnect.chatservice.exception;

/**
 * Custom application exception that carries an {@link ErrorCode}.
 * Used throughout the service layer instead of raw RuntimeException.
 * The {@link GlobalExceptionHandler} catches this and returns a structured JSON response.
 */
public class AppException extends RuntimeException {

    private final ErrorCode errorCode;

    public AppException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public AppException(ErrorCode errorCode, String detailMessage) {
        super(detailMessage);
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}
