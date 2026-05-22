package com.iuhconnect.chatservice.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;

/**
 * Redis Cache Configuration for Chat Service.
 * Implements Cache-Aside pattern for CRUD operations.
 * - conversations: cached for 5 minutes
 * - messages: cached for 3 minutes
 * - default: cached for 10 minutes
 */
@Configuration
@EnableCaching
public class RedisCacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        // Default cache configuration
        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration
                .defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))
                .serializeValuesWith(
                        RedisSerializationContext.SerializationPair
                                .fromSerializer(new GenericJackson2JsonRedisSerializer())
                )
                .disableCachingNullValues();

        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(defaultConfig)
                // Conversation cache — 5 minutes TTL
                .withCacheConfiguration("conversations",
                        defaultConfig.entryTtl(Duration.ofMinutes(5)))
                // Messages cache — 3 minutes TTL
                .withCacheConfiguration("messages",
                        defaultConfig.entryTtl(Duration.ofMinutes(3)))
                .build();
    }
}
