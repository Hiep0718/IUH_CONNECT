package com.iuhconnect.chatservice.config;

import com.iuhconnect.chatservice.dto.ChatMessageDto;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaProducerConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    private Map<String, Object> baseProducerProps() {
        Map<String, Object> props = new HashMap<>();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return props;
    }

    // ── Chat message producer (typed) ──

    @Bean
    public ProducerFactory<String, ChatMessageDto> chatProducerFactory() {
        return new DefaultKafkaProducerFactory<>(baseProducerProps());
    }

    @Bean
    @Primary
    public KafkaTemplate<String, ChatMessageDto> kafkaTemplate() {
        return new KafkaTemplate<>(chatProducerFactory());
    }

    // ── Generic producer for presence events and other non-chat payloads ──

    @Bean
    public ProducerFactory<String, Object> genericProducerFactory() {
        return new DefaultKafkaProducerFactory<>(baseProducerProps());
    }

    @Bean
    public KafkaTemplate<String, Object> presenceKafkaTemplate() {
        return new KafkaTemplate<>(genericProducerFactory());
    }

    @Bean
    public NewTopic chatMessagesTopic() {
        return new NewTopic("chat-messages", 3, (short) 1);
    }
}

