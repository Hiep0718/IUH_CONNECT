package com.iuhconnect.gateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;

/**
 * Dynamic IP Blacklisting Filter for API Gateway.
 * 1. Checks if the client IP is on the Redis blacklist. If so, immediately rejects with a 403 Forbidden.
 * 2. Monitors responses for 429 Too Many Requests (rate-limit violations).
 *    If an IP triggers 429 violations too many times (e.g., > 10 times in 1 minute),
 *    it dynamically bans the IP in Redis for 15 minutes.
 */
@Component
public class IpBlacklistFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(IpBlacklistFilter.class);
    private static final String BLACKLIST_KEY_PREFIX = "blacklist:ip:";
    private static final String VIOLATIONS_KEY_PREFIX = "violations:ip:";

    private static final long BAN_DURATION_MINUTES = 15;
    private static final int MAX_VIOLATIONS_PER_MINUTE = 10;

    private final ReactiveStringRedisTemplate redisTemplate;

    public IpBlacklistFilter(ReactiveStringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        String upgradeHeader = exchange.getRequest().getHeaders().getFirst("Upgrade");

        // Skip dynamic blacklist processing for WebSocket upgrade paths to prevent connection closure
        if (path.startsWith("/ws/") || "websocket".equalsIgnoreCase(upgradeHeader)) {
            return chain.filter(exchange);
        }

        String clientIp = getClientIp(exchange);
        String blacklistKey = BLACKLIST_KEY_PREFIX + clientIp;

        // 1. Check if IP is blacklisted
        return redisTemplate.hasKey(blacklistKey)
                .flatMap(isBlacklisted -> {
                    if (Boolean.TRUE.equals(isBlacklisted)) {
                        log.warn("🚨 [Gateway] Rejected request from blacklisted IP: {}", clientIp);
                        exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
                        return exchange.getResponse().setComplete();
                    }

                    // 2. IP is clean, proceed with filter chain and monitor the response
                    return chain.filter(exchange).then(Mono.defer(() -> {
                        HttpStatusCode statusCode = exchange.getResponse().getStatusCode();

                        // If response is 429 (Too Many Requests), track violation
                        if (statusCode == HttpStatus.TOO_MANY_REQUESTS) {
                            return trackViolation(clientIp);
                        }
                        return Mono.empty();
                    }));
                })
                .onErrorResume(e -> {
                    // Fail-open on Redis errors to prevent locking out valid traffic
                    log.error("⚠️ [Gateway] Redis error in IP Blacklist Filter: {}", e.getMessage());
                    return chain.filter(exchange);
                });
    }

    private Mono<Void> trackViolation(String clientIp) {
        String violationsKey = VIOLATIONS_KEY_PREFIX + clientIp;
        return redisTemplate.opsForValue().increment(violationsKey)
                .flatMap(count -> {
                    if (count == 1) {
                        // Set 1-minute expiration window for tracking violations
                        return redisTemplate.expire(violationsKey, Duration.ofMinutes(1)).then();
                    }

                    if (count > MAX_VIOLATIONS_PER_MINUTE) {
                        String blacklistKey = BLACKLIST_KEY_PREFIX + clientIp;
                        log.error("🚨 [Gateway] IP {} exceeded rate limit {} times. Banning for {} minutes!",
                                clientIp, count, BAN_DURATION_MINUTES);

                        return redisTemplate.opsForValue().set(blacklistKey, "BANNED", Duration.ofMinutes(BAN_DURATION_MINUTES))
                                .then(redisTemplate.delete(violationsKey))
                                .then();
                    }
                    return Mono.empty();
                });
    }

    private String getClientIp(ServerWebExchange exchange) {
        String forwardedFor = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            return forwardedFor.split(",")[0].trim();
        }
        return exchange.getRequest().getRemoteAddress() != null
                ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                : "unknown";
    }

    @Override
    public int getOrder() {
        // Run at the absolute top of the chain (order = -100) to block bad traffic immediately
        return -100;
    }
}
