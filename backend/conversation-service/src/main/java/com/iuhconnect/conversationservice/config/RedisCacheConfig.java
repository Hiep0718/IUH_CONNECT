package com.iuhconnect.conversationservice.config;

import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;

import java.time.Duration;

/**
 * Redis Cache Configuration for Chat Service.
 * - Cache-Aside pattern for CRUD operations (conversations, messages)
 * - CQRS Read Model via StringRedisTemplate (conversation summaries)
 */
@Configuration
@EnableCaching
public class RedisCacheConfig {

    /**
     * StringRedisTemplate for CQRS Read Model operations.
     * Used by ConversationReadModelService to read/write conversation summaries.
     */
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory connectionFactory) {
        return new StringRedisTemplate(connectionFactory);
    }

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
