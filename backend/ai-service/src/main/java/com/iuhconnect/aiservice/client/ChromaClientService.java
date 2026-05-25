package com.iuhconnect.aiservice.client;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChromaClientService {

    private final RestTemplate restTemplate;

    @Value("${app.ai.chromadb.url}")
    private String chromaUrl;
    
    private static final String COLLECTION_NAME = "iuh_knowledge";
    private String collectionId = null;

    private String getOrCreateCollectionId() {
        if (collectionId != null) return collectionId;
        String url = chromaUrl + "/api/v2/tenants/default_tenant/databases/default_database/collections";
        Map<String, Object> request = Map.of(
                "name", COLLECTION_NAME,
                "get_or_create", true
        );
        try {
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
            if (response != null && response.containsKey("id")) {
                collectionId = (String) response.get("id");
                log.info("Initialized ChromaDB collection with ID: {}", collectionId);
                return collectionId;
            }
        } catch (Exception e) {
            log.error("Failed to get or create ChromaDB collection: {}", e.getMessage());
        }
        return null;
    }

    public boolean addKnowledge(List<Double> embedding, String documentText) {
        String colId = getOrCreateCollectionId();
        if (colId == null) return false;

        String url = chromaUrl + "/api/v2/tenants/default_tenant/databases/default_database/collections/" + colId + "/add";
        String id = UUID.randomUUID().toString();
        
        Map<String, Object> request = Map.of(
                "ids", List.of(id),
                "embeddings", List.of(embedding),
                "documents", List.of(documentText),
                "metadatas", List.of(Map.of("source", "webhook"))
        );
        
        try {
            restTemplate.postForObject(url, request, Map.class);
            log.info("Successfully added knowledge to ChromaDB");
            return true;
        } catch (Exception e) {
            log.error("Failed to add knowledge to ChromaDB: {}", e.getMessage());
            return false;
        }
    }

    public List<String> searchKnowledge(List<Double> queryEmbedding, int limit) {
        String colId = getOrCreateCollectionId();
        if (colId == null) return Collections.emptyList();

        String url = chromaUrl + "/api/v2/tenants/default_tenant/databases/default_database/collections/" + colId + "/query";
        Map<String, Object> request = Map.of(
                "query_embeddings", List.of(queryEmbedding),
                "n_results", limit
        );
        
        try {
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
            if (response != null && response.containsKey("documents")) {
                List<List<String>> docs = (List<List<String>>) response.get("documents");
                if (docs != null && !docs.isEmpty()) {
                    return docs.get(0);
                }
            }
        } catch (Exception e) {
            log.error("Failed to search knowledge in ChromaDB: {}", e.getMessage());
        }
        return Collections.emptyList();
    }
}
