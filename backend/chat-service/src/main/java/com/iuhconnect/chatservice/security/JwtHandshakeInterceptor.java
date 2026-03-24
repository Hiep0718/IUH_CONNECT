package com.iuhconnect.chatservice.security;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);

    @Value("${jwt.secret}")
    private String jwtSecret;

    private SecretKey key;

    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        try {
            // Extract token from query parameter: ?token=xxx
            String query = ((ServletServerHttpRequest) request).getServletRequest().getQueryString();
            String token = extractTokenFromQuery(query);

            if (token == null || token.isBlank()) {
                log.warn("🚫 WebSocket handshake rejected: No token provided");
                return false;
            }

            // Validate JWT signature and parse username
            String username = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload()
                    .getSubject();

            // Store username in WebSocket session attributes
            attributes.put("username", username);
            log.info("✅ WebSocket handshake accepted [username={}]", username);
            return true;

        } catch (Exception e) {
            log.warn("🚫 WebSocket handshake rejected: Invalid token - {}", e.getMessage());
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // No-op
    }

    private String extractTokenFromQuery(String query) {
        if (query == null) return null;

        for (String param : query.split("&")) {
            String[] pair = param.split("=", 2);
            if ("token".equals(pair[0]) && pair.length == 2) {
                return pair[1];
            }
        }
        return null;
    }
}
