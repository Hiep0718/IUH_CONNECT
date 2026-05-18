package com.iuhconnect.chatservice.controller;

import io.minio.*;
import io.minio.http.Method;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/files")
public class FileUploadController {

    private static final Logger log = LoggerFactory.getLogger(FileUploadController.class);

    private final MinioClient minioClient;

    @Value("${spring.minio.bucket-name:chat-media}")
    private String bucketName;

    @Value("${spring.minio.url:http://localhost:9000}")
    private String minioUrl;

    @Value("${spring.minio.access-key:iuh_minio_admin}")
    private String accessKey;

    @Value("${spring.minio.secret-key:iuh_minio_password}")
    private String secretKey;

    public FileUploadController(MinioClient minioClient) {
        this.minioClient = minioClient;
    }

    /**
     * Auto-create the bucket on startup if it doesn't exist.
     */
    @PostConstruct
    public void initBucket() {
        try {
            boolean exists = minioClient.bucketExists(
                    BucketExistsArgs.builder().bucket(bucketName).build());
            if (!exists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
                log.info("✅ Created MinIO bucket: {}", bucketName);

                // Set bucket policy to allow public read (for download URLs)
                String policy = """
                    {
                      "Version": "2012-10-17",
                      "Statement": [
                        {
                          "Effect": "Allow",
                          "Principal": {"AWS": ["*"]},
                          "Action": ["s3:GetObject"],
                          "Resource": ["arn:aws:s3:::%s/*"]
                        }
                      ]
                    }
                    """.formatted(bucketName);
                minioClient.setBucketPolicy(
                        SetBucketPolicyArgs.builder()
                                .bucket(bucketName)
                                .config(policy)
                                .build());
                log.info("✅ Set public read policy for bucket: {}", bucketName);
            }
        } catch (Exception e) {
            log.error("❌ Failed to initialize MinIO bucket: {}", e.getMessage(), e);
        }
    }

    /**
     * Generate a presigned PUT URL for the client to upload a file directly to MinIO.
     * Returns JSON with presignedUrl, objectKey, and downloadUrl.
     */
    @GetMapping("/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(
            @RequestParam String fileName,
            @RequestParam String contentType,
            @RequestParam(required = false) String clientHost) {
        try {
            String objectKey = System.currentTimeMillis() + "_" + fileName;

            MinioClient signClient = minioClient;
            if (clientHost != null && !clientHost.trim().isEmpty()) {
                signClient = MinioClient.builder()
                        .endpoint("http://" + clientHost + ":9000")
                        .credentials(accessKey, secretKey)
                        .region("us-east-1")
                        .build();
            }

            // Presigned PUT URL (client uploads here)
            String presignedUrl = signClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(bucketName)
                            .object(objectKey)
                            .expiry(10, TimeUnit.MINUTES)
                            .build());

            // Public download URL (used in chat message)
            String downloadUrl = "http://" + (clientHost != null && !clientHost.trim().isEmpty() ? clientHost : "localhost") + ":9000/" + bucketName + "/" + objectKey;

            Map<String, String> response = new HashMap<>();
            response.put("presignedUrl", presignedUrl);
            response.put("objectKey", objectKey);
            response.put("downloadUrl", downloadUrl);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("❌ Failed to generate presigned URL: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to generate upload URL");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * Generate a presigned GET URL for downloading/viewing a file.
     * Useful for private buckets or temporary access.
     */
    @GetMapping("/download-url")
    public ResponseEntity<Map<String, String>> getDownloadUrl(
            @RequestParam String objectKey) {
        try {
            String presignedUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(objectKey)
                            .expiry(60, TimeUnit.MINUTES)
                            .build());

            Map<String, String> response = new HashMap<>();
            response.put("downloadUrl", presignedUrl);
            response.put("objectKey", objectKey);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("❌ Failed to generate download URL: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to generate download URL");
            return ResponseEntity.internalServerError().body(error);
        }
    }
}
