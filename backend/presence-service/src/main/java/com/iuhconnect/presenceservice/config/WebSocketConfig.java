package com.iuhconnect.presenceservice.config;

import com.iuhconnect.presenceservice.handler.PresenceWebSocketHandler;
import com.iuhconnect.presenceservice.security.JwtHandshakeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final PresenceWebSocketHandler presenceWebSocketHandler;

    public WebSocketConfig(JwtHandshakeInterceptor jwtHandshakeInterceptor,
                           PresenceWebSocketHandler presenceWebSocketHandler) {
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
        this.presenceWebSocketHandler = presenceWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(presenceWebSocketHandler, "/ws/presence")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOrigins("*");
    }
}
