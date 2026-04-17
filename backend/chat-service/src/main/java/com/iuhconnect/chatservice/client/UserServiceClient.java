package com.iuhconnect.chatservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "user-service", url = "${user.service.url:http://localhost:8085/api/v1/users}")
public interface UserServiceClient {

    @GetMapping("/{userId}/avatar")
    String getUserAvatar(@PathVariable("userId") String userId);
}
