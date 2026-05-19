package com.iuhconnect.authservice.config;

import com.iuhconnect.authservice.dto.ContactEventDto;
import com.iuhconnect.authservice.dto.UserEventDto;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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

    private Map<String, Object> commonProducerProps() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return configProps;
    }

    // ── User Events ──

    @Bean
    public ProducerFactory<String, UserEventDto> producerFactory() {
        return new DefaultKafkaProducerFactory<>(commonProducerProps());
    }

    @Bean
    public KafkaTemplate<String, UserEventDto> kafkaTemplate() {
        return new KafkaTemplate<>(producerFactory());
    }

    @Bean
    public NewTopic userEventsTopic() {
        return new NewTopic("user-events", 3, (short) 1);
    }

    // ── Contact Events ──

    @Bean
    public ProducerFactory<String, ContactEventDto> contactProducerFactory() {
        return new DefaultKafkaProducerFactory<>(commonProducerProps());
    }

    @Bean
    public KafkaTemplate<String, ContactEventDto> contactKafkaTemplate() {
        return new KafkaTemplate<>(contactProducerFactory());
    }

    @Bean
    public NewTopic contactEventsTopic() {
        return new NewTopic("contact-events", 3, (short) 1);
    }
}

