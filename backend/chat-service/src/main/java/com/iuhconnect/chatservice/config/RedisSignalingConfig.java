package com.iuhconnect.chatservice.config;

import com.iuhconnect.chatservice.handler.SignalingRedisSubscriber;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;

@Configuration
public class RedisSignalingConfig {

    @Value("${server.instance.id:${random.uuid}}")
    private String instanceId;

    @Bean
    public RedisMessageListenerContainer redisContainer(RedisConnectionFactory connectionFactory,
                                                        SignalingRedisSubscriber subscriber) {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(connectionFactory);
        // Listen only to messages destined for this specific instance
        container.addMessageListener(subscriber, new PatternTopic("signaling:" + instanceId));
        return container;
    }
}
