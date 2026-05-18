package com.iuhconnect.notificationservice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.support.converter.JsonMessageConverter;
import org.springframework.kafka.support.converter.RecordMessageConverter;

@Configuration
public class KafkaConsumerConfig {

    // Bean này giúp Spring Kafka tự động map chuỗi JSON (StringDeserializer) 
    // sang Object DTO tương ứng với tham số của hàm @KafkaListener.
    // Cách này giải quyết triệt để lỗi TypeHeader và nhiều DTO khác nhau trong cùng 1 service.
    @Bean
    public RecordMessageConverter converter() {
        return new JsonMessageConverter();
    }
}
