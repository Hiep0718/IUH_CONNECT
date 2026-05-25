package com.iuhconnect.aiservice.controller;

import com.iuhconnect.aiservice.client.ChatClientService;
import com.iuhconnect.aiservice.client.ChromaClientService;
import com.iuhconnect.aiservice.client.OllamaClientService;
import com.iuhconnect.aiservice.dto.AiAskRequest;
import com.iuhconnect.aiservice.dto.AiAskResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final OllamaClientService ollamaClientService;
    private final ChromaClientService chromaClientService;
    private final ChatClientService chatClientService;

    @PostMapping("/knowledge/update")
    public ResponseEntity<Map<String, String>> updateKnowledge(@RequestBody Map<String, String> request) {
        String document = request.get("document");
        if (document == null || document.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Document content is required"));
        }
        
        List<Double> embedding = ollamaClientService.generateEmbedding(document);
        if (embedding == null) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to generate embedding from Ollama"));
        }
        
        boolean success = chromaClientService.addKnowledge(embedding, document);
        if (success) {
            return ResponseEntity.ok(Map.of("message", "Knowledge updated successfully"));
        } else {
            return ResponseEntity.internalServerError().body(Map.of("message", "Failed to save knowledge to Vector DB"));
        }
    }

    @PostMapping("/ask")
    public ResponseEntity<AiAskResponse> askAi(@RequestBody AiAskRequest request) {
        String question = request.getQuestion();
        
        // 1. Generate embedding for the question
        List<Double> queryEmbedding = ollamaClientService.generateEmbedding(question);
        
        // 2. Search knowledge base
        String context = "";
        if (queryEmbedding != null) {
            List<String> docs = chromaClientService.searchKnowledge(queryEmbedding, 3);
            if (!docs.isEmpty()) {
                context = "Dưới đây là thông tin tham khảo từ quy chế trường: \n- " + String.join("\n- ", docs) + "\n\n";
            }
        }
        
        // 3. Prompt Engineering with Context (RAG)
        String systemPrompt = "Bạn là trợ lý ảo thân thiện của trường Đại học Công nghiệp TP.HCM (tên là IUH Assistant). Hãy trả lời ngắn gọn, thân thiện bằng tiếng Việt. " +
                "Dựa vào thông tin sau để trả lời (nếu không liên quan thì bỏ qua):\n" +
                context +
                "Câu hỏi của người dùng: " + question;
        
        String answer = ollamaClientService.generateAnswer(systemPrompt);
        return ResponseEntity.ok(new AiAskResponse(answer));
    }

    @GetMapping("/summarize/{conversationId}")
    public ResponseEntity<Map<String, String>> summarizeConversation(@PathVariable String conversationId) {
        String context = chatClientService.getConversationContext(conversationId, 50);
        
        if (context == null || context.equals("Không có tin nhắn nào.")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Không thể lấy lịch sử chat hoặc nhóm chưa có tin nhắn."));
        }

        String prompt = "Bạn là trợ lý AI chuyên nghiệp phân tích và tóm tắt hội thoại. " +
                "Dưới đây là lịch sử chat nhóm. Yêu cầu bắt buộc:\n" +
                "1. TUYỆT ĐỐI KHÔNG trích dẫn lại hoặc lặp lại từng câu tin nhắn.\n" +
                "2. CHỈ TỔNG HỢP VÀ TÓM TẮT các ý chính, các sự kiện, quyết định, hoặc công việc (deadline) được chốt lại.\n" +
                "3. Viết thành các gạch đầu dòng ngắn gọn, súc tích, dễ hiểu.\n\n" + 
                "Nội dung đoạn chat:\n" + context;
        
        String summary = ollamaClientService.generateAnswer(prompt);
        return ResponseEntity.ok(Map.of("summary", summary));
    }
}
