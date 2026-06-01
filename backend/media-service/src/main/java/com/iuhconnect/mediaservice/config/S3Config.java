package com.iuhconnect.mediaservice.config;

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

    @Value("${aws.s3.access-key:}")
    private String accessKey;

    @Value("${aws.s3.secret-key:}")
    private String secretKey;

    private boolean isAwsConfigured() {
        return accessKey != null && !accessKey.trim().isEmpty()
            && secretKey != null && !secretKey.trim().isEmpty();
    }

    @Bean
    public S3Client s3Client() {
        if (!isAwsConfigured()) {
            log.warn("⚠️ AWS S3 credentials are missing or empty. S3Client will NOT be created. File upload features are disabled.");
            return null;
        }
        try {
            S3Client client = S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKey.trim(), secretKey.trim())))
                    .build();
            log.info("✅ S3Client initialized successfully for region: {}", region);
            return client;
        } catch (Exception e) {
            log.error("❌ Failed to initialize S3Client: {}", e.getMessage());
            return null;
        }
    }

    @Bean
    public S3Presigner s3Presigner() {
        if (!isAwsConfigured()) {
            log.warn("⚠️ AWS S3 credentials are missing or empty. S3Presigner will NOT be created. Presigned URL features are disabled.");
            return null;
        }
        try {
            S3Presigner presigner = S3Presigner.builder()
                    .region(Region.of(region))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKey.trim(), secretKey.trim())))
                    .build();
            log.info("✅ S3Presigner initialized successfully for region: {}", region);
            return presigner;
        } catch (Exception e) {
            log.error("❌ Failed to initialize S3Presigner: {}", e.getMessage());
            return null;
        }
    }
}

