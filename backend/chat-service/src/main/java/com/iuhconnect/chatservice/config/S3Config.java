package com.iuhconnect.chatservice.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class S3Config {

    private static final Logger log = LoggerFactory.getLogger(S3Config.class);

    @Value("${aws.s3.region:ap-southeast-1}")
    private String region;

    @Value("${aws.s3.access-key}")
    private String accessKey;

    @Value("${aws.s3.secret-key}")
    private String secretKey;

    @Bean
    public S3Client s3Client() {
        try {
            if (accessKey == null || accessKey.isBlank()) {
                log.warn("⚠️ AWS S3 access key is missing. S3 features will be disabled.");
                return null;
            }
            return S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKey, secretKey)))
                    .build();
        } catch (Exception e) {
            log.error("❌ Failed to initialize S3Client: {}", e.getMessage());
            return null;
        }
    }

    @Bean
    public S3Presigner s3Presigner() {
        try {
            if (accessKey == null || accessKey.isBlank()) {
                log.warn("⚠️ AWS S3 access key is missing. Presigner features will be disabled.");
                return null;
            }
            return S3Presigner.builder()
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKey, secretKey)))
                    .build();
        } catch (Exception e) {
            log.error("❌ Failed to initialize S3Presigner: {}", e.getMessage());
            return null;
        }
    }
}
