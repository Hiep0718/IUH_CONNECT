package com.iuhconnect.conversationservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class ConversationServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ConversationServiceApplication.class, args);
    }
}
