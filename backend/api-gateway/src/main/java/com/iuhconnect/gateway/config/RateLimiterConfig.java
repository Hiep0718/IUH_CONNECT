package com.iuhconnect.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import reactor.core.publisher.Mono;

/**
 * Hybrid Rate Limiter Configuration for API Gateway.
 * Provides two KeyResolver strategies backed by Redis token-bucket algorithm:
 * <ul>
 *   <li><b>ipKeyResolver</b> — IP-based limiting for public/unauthenticated APIs
 *       (login, register) to prevent brute-force attacks.</li>
 *   <li><b>userKeyResolver</b> — User-based limiting for authenticated APIs
 *       (chat, AI, file upload) to ensure fairness per account and avoid
 *       false-positive blocking when many users share the same NAT IP
 *       (e.g., campus Wi-Fi at IUH).</li>
 * </ul>
 */
@Configuration
public class RateLimiterConfig {

    /**
     * Level 1: Resolves the rate limit key based on client IP address.
     * Used for public APIs (login, register) to block brute-force attempts.
     * Each unique IP gets its own rate limit bucket.
     *
     * Supports X-Forwarded-For header for deployments behind
     * reverse proxy / load balancer (e.g., Nginx, AWS ALB).
     */
    @Bean
    @Primary
    public KeyResolver ipKeyResolver() {
        return exchange -> {
            // Check X-Forwarded-For first (real client IP when behind proxy)
            String forwardedFor = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
            if (forwardedFor != null && !forwardedFor.isEmpty()) {
                // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
                // The first one is the real client IP
                String clientIp = forwardedFor.split(",")[0].trim();
                return Mono.just(clientIp);
            }
            // Fallback to direct connection IP
            String ip = exchange.getRequest().getRemoteAddress() != null
                    ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                    : "unknown";
            return Mono.just(ip);
        };
    }

    /**
     * Level 2: Resolves the rate limit key based on authenticated username.
     * Used for private APIs that require JWT authentication.
     * The username is extracted from the "X-Auth-User" header which is
     * injected by {@link com.iuhconnect.gateway.filter.JwtAuthFilter}
     * after successful JWT validation.
     *
     * Falls back to IP-based key with "anonymous_" prefix if the user
     * header is not present (e.g., request bypassed auth or token expired).
     */
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> {
            String user = exchange.getRequest().getHeaders().getFirst("X-Auth-User");
            if (user != null && !user.isEmpty()) {
                return Mono.just(user);
            }
            // Fallback to IP if user info is not available
            String ip = exchange.getRequest().getRemoteAddress() != null
                    ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                    : "unknown";
            return Mono.just("anonymous_" + ip);
        };
    }
}
