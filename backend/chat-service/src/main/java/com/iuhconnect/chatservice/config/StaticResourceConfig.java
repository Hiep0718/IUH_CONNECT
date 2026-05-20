package com.iuhconnect.chatservice.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Đảm bảo Spring Boot phục vụ các file trong thư mục static/meeting
        registry.addResourceHandler("/meeting/**")
                .addResourceLocations("classpath:/static/meeting/");
    }
}
