package com.iuhconnect.mediaservice.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/files")
public class FileUploadController {

    private static final Logger log = LoggerFactory.getLogger(FileUploadController.class);

    @Autowired(required = false)
    private S3Presigner s3Presigner;

    @Value("${aws.s3.bucket-name:iuh-connect-chat-media}")
    private String bucketName;
    
    @Value("${aws.s3.region:ap-southeast-1}")
    private String region;

    /**
     * Generate a presigned PUT URL for the client to upload a file directly to AWS S3.
     * Returns JSON with presignedUrl, objectKey, and downloadUrl.
     */
    @GetMapping("/presigned-url")
    public ResponseEntity<Map<String, String>> getPresignedUrl(
            @RequestParam String fileName,
            @RequestParam String contentType,
            @RequestParam(required = false) String clientHost) {
        if (s3Presigner == null) {
            log.warn("⚠️ S3 Presigner is not initialized. AWS credentials may be missing.");
            Map<String, String> error = new HashMap<>();
            error.put("error", "File upload is temporarily disabled due to missing configuration.");
            return ResponseEntity.status(503).body(error);
        }
        try {
            String objectKey = System.currentTimeMillis() + "_" + fileName.replaceAll("[^a-zA-Z0-9.-]", "_");

            PutObjectRequest objectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .contentType(contentType)
                    .build();

            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(10))
                    .putObjectRequest(objectRequest)
                    .build();

            PresignedPutObjectRequest presignedRequest = s3Presigner.presignPutObject(presignRequest);
            String presignedUrl = presignedRequest.url().toString();

            // S3 standard public URL format: https://bucket-name.s3.region.amazonaws.com/objectKey
            String downloadUrl = String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, objectKey);

            Map<String, String> response = new HashMap<>();
            response.put("presignedUrl", presignedUrl);
            response.put("objectKey", objectKey);
            response.put("downloadUrl", downloadUrl);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("❌ Failed to generate S3 presigned PUT URL: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to generate upload URL");
            return ResponseEntity.internalServerError().body(error);
        }
    }

    /**
     * Generate a presigned GET URL for downloading/viewing a file securely.
     */
    @GetMapping("/download-url")
    public ResponseEntity<Map<String, String>> getDownloadUrl(
            @RequestParam String objectKey) {
        if (s3Presigner == null) {
            log.warn("⚠️ S3 Presigner is not initialized. AWS credentials may be missing.");
            Map<String, String> error = new HashMap<>();
            error.put("error", "File download is temporarily disabled due to missing configuration.");
            return ResponseEntity.status(503).body(error);
        }
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .build();

            GetObjectPresignRequest getObjectPresignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(60))
                    .getObjectRequest(getObjectRequest)
                    .build();

            PresignedGetObjectRequest presignedGetObjectRequest = s3Presigner.presignGetObject(getObjectPresignRequest);
            String presignedUrl = presignedGetObjectRequest.url().toString();

            Map<String, String> response = new HashMap<>();
            response.put("downloadUrl", presignedUrl);
            response.put("objectKey", objectKey);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("❌ Failed to generate S3 presigned GET URL: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "Failed to generate download URL");
            return ResponseEntity.internalServerError().body(error);
        }
    }
}

