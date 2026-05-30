package com.iuhconnect.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Global JWT Authentication Filter for API Gateway.
 * Validates JWT tokens before routing requests to downstream services.
 * Public paths (login, register, refresh) are whitelisted.
 */
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    /**
     * Paths that do NOT require JWT authentication.
     */
    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/api/v1/ai",
            "/meeting",
            "/api/v1/meetings/desktop-session"
    );

    /**
     * WebSocket paths — JWT is passed as query param, handled by downstream services.
     */
    private static final List<String> WS_PATHS = List.of(
            "/ws/chat",
            "/ws/presence"
    );

    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey key;

    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // 1. Skip public paths
        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        String token;

        // 2. Handle WebSocket paths (JWT passed as query param or standard header)
        if (isWebSocketPath(path)) {
            token = exchange.getRequest().getQueryParams().getFirst("token");
            if (token == null || token.isEmpty()) {
                // Fallback to Authorization header if query param is not set
                String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    token = authHeader.substring(7);
                } else {
                    log.warn("🚫 [Gateway] Missing token for WebSocket connection at path: {}", path);
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }
            }
        } else {
            // 3. Extract Bearer token from Authorization header for REST APIs
            String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.warn("🚫 [Gateway] Missing or invalid Authorization header for path: {}", path);
                exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                return exchange.getResponse().setComplete();
            }

            token = authHeader.substring(7);
        }

        // 4. Validate JWT
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String username = claims.getSubject();
            String role = claims.get("role", String.class);

            // 5. Add user info to request headers for downstream services
            ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                    .header("X-Auth-User", username)
                    .header("X-Auth-Role", role != null ? role : "")
                    .build();

            log.debug("✅ [Gateway] JWT valid — user={}, role={}, path={}", username, role, path);
            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (Exception e) {
            log.warn("🚫 [Gateway] Invalid JWT token for path {}: {}", path, e.getMessage());
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }

    @Override
    public int getOrder() {
        return -1; // Execute before all other filters
    }

    private boolean isPublicPath(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }

    private boolean isWebSocketPath(String path) {
        return WS_PATHS.stream().anyMatch(path::startsWith);
    }
}
