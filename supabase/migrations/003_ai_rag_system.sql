-- Phase 4: AI Integrations & RAG System Migration
-- Adds knowledge base, embeddings, and AI interactions tables

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Base Categories
CREATE TABLE knowledge_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge Base Documents
CREATE TABLE knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES knowledge_categories(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text', -- 'text', 'markdown', 'pdf', 'docx'
  source_url TEXT,
  tags TEXT[], -- Array of tags for filtering
  metadata JSONB DEFAULT '{}', -- Additional metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- RLS Policy: Users can only access documents from their agency
  CONSTRAINT fk_knowledge_documents_agency FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

-- Document Embeddings (using pgvector)
CREATE TABLE document_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL, -- Index of the chunk within the document
  chunk_content TEXT NOT NULL, -- The actual text chunk
  embedding vector(1024), -- Voyage AI embeddings dimension
  model_used VARCHAR(100) DEFAULT 'voyage-3-large', -- Embedding model used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- RLS Policy: Users can only access embeddings from their agency
  CONSTRAINT fk_document_embeddings_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT fk_document_embeddings_document FOREIGN KEY (document_id) REFERENCES knowledge_documents(id)
);

-- AI Chat Sessions
CREATE TABLE ai_chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_name VARCHAR(255),
  model_used VARCHAR(100) DEFAULT 'openai/gpt-4o',
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- RLS Policy: Users can only access their own chat sessions
  CONSTRAINT fk_ai_chat_sessions_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT fk_ai_chat_sessions_user FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- AI Chat Messages
CREATE TABLE ai_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  model_used VARCHAR(100),
  metadata JSONB DEFAULT '{}', -- Additional metadata like citations, sources
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- RLS Policy: Users can only access messages from their sessions
  CONSTRAINT fk_ai_chat_messages_session FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id)
);

-- AI Recommendations/Insights
CREATE TABLE ai_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(100) NOT NULL, -- 'booking_optimization', 'pricing_suggestion', 'customer_insight'
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  data JSONB DEFAULT '{}', -- Supporting data for the recommendation
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'applied', 'dismissed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- RLS Policy: Users can only access recommendations from their agency
  CONSTRAINT fk_ai_recommendations_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT fk_ai_recommendations_user FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- AI Usage Tracking
CREATE TABLE ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL, -- 'chat', 'embeddings', 'recommendations'
  model_used VARCHAR(100),
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  request_data JSONB DEFAULT '{}',
  response_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- RLS Policy: Users can only access their agency's usage logs
  CONSTRAINT fk_ai_usage_logs_agency FOREIGN KEY (agency_id) REFERENCES agencies(id),
  CONSTRAINT fk_ai_usage_logs_user FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- Indexes for performance
CREATE INDEX idx_knowledge_documents_agency_category ON knowledge_documents(agency_id, category_id);
CREATE INDEX idx_knowledge_documents_tags ON knowledge_documents USING gin(tags);
CREATE INDEX idx_knowledge_documents_metadata ON knowledge_documents USING gin(metadata);

-- Vector similarity search index (requires pgvector)
CREATE INDEX idx_document_embeddings_embedding ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_ai_chat_sessions_agency_user ON ai_chat_sessions(agency_id, user_id);
CREATE INDEX idx_ai_chat_messages_session ON ai_chat_messages(session_id);
CREATE INDEX idx_ai_recommendations_agency_type ON ai_recommendations(agency_id, recommendation_type);
CREATE INDEX idx_ai_usage_logs_agency_service ON ai_usage_logs(agency_id, service_type);

-- Row Level Security (RLS) Policies

-- Knowledge Documents
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their agency's documents" ON knowledge_documents
  FOR ALL USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- Document Embeddings
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their agency's embeddings" ON document_embeddings
  FOR ALL USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- AI Chat Sessions
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own chat sessions" ON ai_chat_sessions
  FOR ALL USING (user_id = auth.uid() AND agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- AI Chat Messages
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access messages from their sessions" ON ai_chat_messages
  FOR ALL USING (session_id IN (
    SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid()
  ));

-- AI Recommendations
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their agency's recommendations" ON ai_recommendations
  FOR ALL USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- AI Usage Logs
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their agency's usage logs" ON ai_usage_logs
  FOR ALL USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- Insert default knowledge categories
INSERT INTO knowledge_categories (name, description) VALUES
  ('general', 'Información general sobre viajes y turismo'),
  ('destinations', 'Información específica sobre destinos turísticos'),
  ('policies', 'Políticas y procedimientos de la agencia'),
  ('pricing', 'Información sobre precios y tarifas'),
  ('regulations', 'Regulaciones y requisitos legales');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_knowledge_categories_updated_at BEFORE UPDATE ON knowledge_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_documents_updated_at BEFORE UPDATE ON knowledge_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_chat_sessions_updated_at BEFORE UPDATE ON ai_chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_recommendations_updated_at BEFORE UPDATE ON ai_recommendations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
