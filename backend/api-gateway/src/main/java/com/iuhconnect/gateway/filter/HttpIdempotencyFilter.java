package com.iuhconnect.gateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;

/**
 * HTTP Idempotency Filter for API Gateway.
 * Intercepts POST and PUT requests that carry an 'X-Idempotency-Key' header.
 * Uses Reactive Redis distributed locking to prevent duplicate operations from being processed concurrently or repeatedly.
 */
@Component
public class HttpIdempotencyFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(HttpIdempotencyFilter.class);
    private static final String IDEMPOTENCY_KEY_HEADER = "X-Idempotency-Key";
    private static final String REDIS_KEY_PREFIX = "idempotency:";
    private static final long LOCK_TTL_SECONDS = 10; // 10-second lock window

    private final ReactiveStringRedisTemplate redisTemplate;

    public HttpIdempotencyFilter(ReactiveStringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        HttpMethod method = exchange.getRequest().getMethod();

        // Only apply to POST or PUT requests
        if (method != HttpMethod.POST && method != HttpMethod.PUT) {
            return chain.filter(exchange);
        }

        String idempotencyKey = exchange.getRequest().getHeaders().getFirst(IDEMPOTENCY_KEY_HEADER);
        if (idempotencyKey == null || idempotencyKey.isEmpty()) {
            return chain.filter(exchange);
        }

        String redisKey = REDIS_KEY_PREFIX + idempotencyKey;

        // Attempt to acquire lock using SETNX reactively
        return redisTemplate.opsForValue()
                .setIfAbsent(redisKey, "PROCESSING", Duration.ofSeconds(LOCK_TTL_SECONDS))
                .flatMap(isFirstRequest -> {
                    if (Boolean.TRUE.equals(isFirstRequest)) {
                        log.debug("🔑 [Gateway] Idempotency lock acquired for key: {}", idempotencyKey);
                        return chain.filter(exchange);
                    } else {
                        log.warn("🚫 [Gateway] Duplicate request detected for Idempotency-Key: {}", idempotencyKey);
                        
                        // Return 409 Conflict for duplicate requests (intercepted by StandardizedErrorResponseFilter)
                        exchange.getResponse().setStatusCode(HttpStatus.CONFLICT);
                        return exchange.getResponse().setComplete();
                    }
                })
                .onErrorResume(e -> {
                    // Fallback in case Redis is down: log error and allow request to pass (fail-open)
                    log.error("⚠️ [Gateway] Redis error in Idempotency Filter, falling back to fail-open: {}", e.getMessage(), e);
                    return chain.filter(exchange);
                });
    }

    @Override
    public int getOrder() {
        // Run AFTER JwtAuthFilter (order = -1) but BEFORE other filters
        return -5;
    }
}
