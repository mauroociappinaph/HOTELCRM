-- Fix: Create missing RPC function for vector search with strict multitenancy isolation

CREATE OR REPLACE FUNCTION search_similar_documents (
  query_embedding vector(1024),
  agency_id uuid,
  match_limit int
)
RETURNS TABLE (
  document_id uuid,
  chunk_content text,
  similarity float,
  document_title text,
  document_category text
)
LANGUAGE plpgsql
SECURITY DEFINER -- Use security definer to bypass RLS for the function logic, but we enforce agency_id manually
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.document_id,
    de.chunk_content,
    1 - (de.embedding <=> query_embedding) as similarity,
    kd.title as document_title,
    kc.name as document_category
  FROM document_embeddings de
  JOIN knowledge_documents kd ON de.document_id = kd.id
  LEFT JOIN knowledge_categories kc ON kd.category_id = kc.id
  WHERE de.agency_id = search_similar_documents.agency_id -- CRITICAL: Enforce tenancy
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_limit;
END;
$$;
