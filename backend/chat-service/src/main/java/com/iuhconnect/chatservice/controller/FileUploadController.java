package com.iuhconnect.chatservice.controller;

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1/files")
public class FileUploadController {

    private final MinioClient minioClient;

    public FileUploadController(MinioClient minioClient) {
        this.minioClient = minioClient;
    }

    @GetMapping("/presigned-url")
    public String getPresignedUrl(@RequestParam String fileName, @RequestParam String contentType) throws Exception {
        // Sinh presigned url de client co the upload truc tiep len minio ma khong qua Chat Service
        return minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                        .method(Method.PUT)
                        .bucket("chat-media")
                        .object(System.currentTimeMillis() + "_" + fileName)
                        .expiry(5, TimeUnit.MINUTES)
                        .build());
    }
}
