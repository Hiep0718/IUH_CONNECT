package com.iuhconnect.presenceservice.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // WebSocket endpoints — handled by JwtHandshakeInterceptor, not Spring Security
                .requestMatchers("/ws/**").permitAll()
                // Health/Actuator endpoints — public
                .requestMatchers("/actuator/**").permitAll()
                .requestMatchers("/api/v1/presence/health").permitAll()
                // Work status write endpoints — LECTURER only
                .requestMatchers(HttpMethod.PUT, "/api/v1/presence/work-status").hasRole("LECTURER")
                .requestMatchers(HttpMethod.DELETE, "/api/v1/presence/work-status").hasRole("LECTURER")
                // Work status read — authenticated users
                .requestMatchers(HttpMethod.GET, "/api/v1/presence/work-status/**").authenticated()
                // Other presence endpoints — public (bulk presence, single presence)
                .requestMatchers("/api/v1/presence/**").permitAll()
                .anyRequest().permitAll()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
