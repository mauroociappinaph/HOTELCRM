# Security Investigation Report - 2026-01-21

## Executive Summary
This report details the investigation into two potential security vulnerabilities flagged in the `SECURITY_ANALYSIS_TODO.md` file:
1.  **PostgREST Injection** in `supabase.repository.ts` (originally flagged at line 301).
2.  **Potential Information Disclosure** in `supabase.repository.ts` (originally flagged at line 232).

## Findings

### 1. PostgREST Injection (`query.query`)

*   **Location:** `apps/auth-service/src/infrastructure/repositories/supabase.repository.ts` (found at line 580 in `search` method).
*   **Vulnerability:** The code constructs a PostgREST `.or()` filter string using `${query.query}` without sanitization.
    ```typescript
    const searchConditions = query.fields.map(
      (field: string) => `${field}.ilike.%${query.query}%`,
    );
    dbQuery = dbQuery.or(searchConditions.join(','));
    ```
*   **Risk:** If `query.query` contains special characters like `,`, `(`, or `)`, it could manipulate the query structure, potentially bypassing filters or altering logic.
*   **Current Status:** **Dormant**. The `search` method and its consumer `searchByContent` are not currently called by any active controller or service logic exposed to user input.
*   **Remediation:** Input sanitization is recommended to prevent future exploitation if this code becomes active. We will strip special characters `,`, `(`, `)` from the query string.

### 2. Potential Information Disclosure (`options.select`)

*   **Location:** `apps/auth-service/src/infrastructure/repositories/supabase.repository.ts` (found at line 261 in `findMany` method).
*   **Vulnerability:** The method accepts `options.select` and passes it directly to the database query.
    ```typescript
    const selectFields = options?.select || '*';
    let query = this.supabaseService.getClient().from(this.tableName).select(selectFields);
    ```
*   **Risk:** If an attacker can control `options.select`, they could request sensitive fields that might otherwise be hidden.
*   **Current Status:** **Verified Safe**. A comprehensive search of the codebase confirms that `findMany` is only called internally with hardcoded options or within controlled contexts (e.g., `paginate`). No controller endpoints expose the `QueryOptions` object directly to user input.
*   **Remediation:** No code change required at this time. Developers should remain aware not to expose `QueryOptions` directly in API DTOs without validation.

## Actions Taken
1.  Documented findings in this report.
2.  Applied sanitization patch to `supabase.repository.ts` for the PostgREST injection vector.
3.  Updated `SECURITY_ANALYSIS_TODO.md` to mark items as investigated.
