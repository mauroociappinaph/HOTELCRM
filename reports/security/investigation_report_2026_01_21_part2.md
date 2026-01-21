# Security Investigation Report - 2026-01-21 (Part 2)

## Executive Summary
This report details the investigation into three potential security vulnerabilities flagged in `SECURITY_ANALYSIS_TODO.md`:
1.  **Prompt Injection / PII Leak** in `ChatService` (LLM interaction).
2.  **Multitenancy Isolation** in `EmbeddingsService` (`searchSimilarDocuments`).
3.  **PII Handling** in `MemoryManagerService` (`storeEpisodicMemory`).

## Findings

### 1. Prompt Injection & PII Leak (LLM Interaction)

*   **Location:** `apps/auth-service/src/modules/ai/chat.service.ts` (`sendMessage` method).
*   **Vulnerability:** The system was sending raw user input directly to the LLM and storing it in the database without PII filtering.
*   **Risk:**
    *   **PII Leak:** Sensitive data (Credit Cards, SSNs, Emails) could be sent to the third-party LLM provider (OpenRouter) and stored permanently in the application database/memory.
    *   **Prompt Injection:** While the input is passed as a 'user' role message (reducing direct injection risk), stored prompts in memory could lead to second-order injection attacks if not sanitized.
*   **Remediation:** Implemented a `PiiService` that scrubs sensitive patterns (Email, Credit Card, SSN) from the user message **before** it enters the processing pipeline. The sanitized message is used for LLM inference, memory storage, and embedding search.

### 2. Multitenancy Isolation (`searchSimilarDocuments`)

*   **Location:** `apps/auth-service/src/modules/ai/embeddings.service.ts` calling RPC `search_similar_documents`.
*   **Vulnerability:** The code called a Postgres RPC function `search_similar_documents` passing an `agency_id`. However, investigation of `supabase/migrations/` revealed that **this function was not defined** in the codebase.
*   **Risk:** If the function existed in the database but wasn't managed in code (Drift), we couldn't guarantee it enforced tenancy. If it didn't exist, the feature was broken.
*   **Remediation:** Created `supabase/migrations/008_create_search_similar_documents_rpc.sql` which defines the function with **strict** `WHERE de.agency_id = search_similar_documents.agency_id` clause, enforcing isolation at the database level.

### 3. PII Handling in Memory Storage (`storeEpisodicMemory`)

*   **Location:** `apps/auth-service/src/modules/context-manager/memory-manager.service.ts`.
*   **Vulnerability:** The service stored whatever content was passed to it. `ChatService` was passing raw user/assistant conversation pairs.
*   **Risk:** Permanent storage of PII in the `episodic_memories` table.
*   **Remediation:** By implementing PII scrubbing at the entry point (`ChatService.sendMessage`), the content passed to `storeEpisodicMemory` is now already sanitized. No changes were needed in `MemoryManagerService` itself as the data source is now clean.

## Actions Taken
1.  Created `apps/auth-service/src/modules/security/pii.service.ts` for regex-based redaction.
2.  Updated `apps/auth-service/src/modules/security/security.module.ts` to export the new service.
3.  Updated `apps/auth-service/src/modules/ai/ai.module.ts` to import `SecurityModule`.
4.  Patched `apps/auth-service/src/modules/ai/chat.service.ts` to inject `PiiService` and scrub inputs.
5.  Created `supabase/migrations/008_create_search_similar_documents_rpc.sql` to define the missing secure RPC function.
6.  Updated `SECURITY_ANALYSIS_TODO.md`.
