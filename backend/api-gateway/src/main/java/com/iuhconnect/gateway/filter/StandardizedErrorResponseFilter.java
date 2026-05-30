package com.iuhconnect.gateway.filter;

import org.reactivestreams.Publisher;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.http.server.reactive.ServerHttpResponseDecorator;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

/**
 * Standardized Error Response Filter for API Gateway.
 * Intercepts common gateway-level error status codes (401, 403, 429)
 * and formats the response body as a standard JSON error response,
 * aligning with the downstream microservices exception schema (AppException/ErrorCode).
 */
@Component
public class StandardizedErrorResponseFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpResponse originalResponse = exchange.getResponse();
        DataBufferFactory bufferFactory = originalResponse.bufferFactory();

        ServerHttpResponseDecorator decoratedResponse = new ServerHttpResponseDecorator(originalResponse) {

            private Mono<Void> writeCustomError(HttpStatus status) {
                String errorCode;
                String message;

                if (status == HttpStatus.TOO_MANY_REQUESTS) {
                    errorCode = "TOO_MANY_REQUESTS";
                    message = "Too many requests. Rate limit exceeded. Please try again later.";
                } else if (status == HttpStatus.UNAUTHORIZED) {
                    errorCode = "UNAUTHORIZED";
                    message = "Invalid or missing authentication token.";
                } else if (status == HttpStatus.FORBIDDEN) {
                    errorCode = "FORBIDDEN";
                    message = "Access denied. Your request has been blocked or you do not have permission.";
                } else {
                    errorCode = status.name();
                    message = status.getReasonPhrase();
                }

                getHeaders().setContentType(MediaType.APPLICATION_JSON);
                String body = String.format("{\"errorCode\":\"%s\",\"message\":\"%s\",\"status\":%d}",
                        errorCode, message, status.value());
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                DataBuffer buffer = bufferFactory.wrap(bytes);
                getHeaders().setContentLength(bytes.length);
                return getDelegate().writeWith(Mono.just(buffer));
            }

            private boolean isInterceptableStatus(HttpStatusCode status) {
                if (status instanceof HttpStatus) {
                    HttpStatus httpStatus = (HttpStatus) status;
                    return httpStatus == HttpStatus.TOO_MANY_REQUESTS
                            || httpStatus == HttpStatus.UNAUTHORIZED
                            || httpStatus == HttpStatus.FORBIDDEN;
                }
                return false;
            }

            @Override
            public Mono<Void> setComplete() {
                HttpStatusCode status = getStatusCode();
                if (status != null && isInterceptableStatus(status)) {
                    return writeCustomError((HttpStatus) status);
                }
                return super.setComplete();
            }

            @Override
            public Mono<Void> writeWith(Publisher<? extends DataBuffer> body) {
                HttpStatusCode status = getStatusCode();
                if (status != null && isInterceptableStatus(status)) {
                    return writeCustomError((HttpStatus) status);
                }
                return super.writeWith(body);
            }
        };

        return chain.filter(exchange.mutate().response(decoratedResponse).build());
    }

    @Override
    public int getOrder() {
        // Run BEFORE other filters to wrap the response early in the chain
        return -20;
    }
}
