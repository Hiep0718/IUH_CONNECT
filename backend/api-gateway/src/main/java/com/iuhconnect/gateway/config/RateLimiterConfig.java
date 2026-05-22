package com.iuhconnect.gateway.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Mono;

/**
 * Rate Limiter Configuration for API Gateway.
 * Uses Redis-based token bucket algorithm to limit API calls per user/IP.
 */
@Configuration
public class RateLimiterConfig {

    /**
     * Resolves the rate limit key based on client IP address.
     * Each unique IP gets its own rate limit bucket.
     */
    @Bean
    public KeyResolver userKeyResolver() {
        return exchange -> {
            String ip = exchange.getRequest().getRemoteAddress() != null
                    ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                    : "unknown";
            return Mono.just(ip);
        };
    }
}
