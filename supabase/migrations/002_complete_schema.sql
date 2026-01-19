-- Migración: 002_complete_schema
-- Fecha: 2026-01-19
-- Descripción: Completar esquema según modelo de negocio - impuestos, IA y videollamadas

-- Tabla para percepciones fiscales argentinas (Imp. PAIS y Ganancias)
CREATE TABLE IF NOT EXISTS tax_perceptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  tax_type VARCHAR(20) NOT NULL CHECK (tax_type IN ('PAIS', 'GANANCIAS')),
  amount DECIMAL(10, 2) NOT NULL,
  percentage DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para base de conocimientos IA (RAG system)
CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  tags TEXT[],
  embedding vector(1536), -- Para Voyage AI embeddings
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para sesiones de videollamadas
CREATE TABLE IF NOT EXISTS video_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  session_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  recording_url TEXT,
  sentiment_analysis JSONB,
  transcription TEXT,
  duration_minutes INTEGER,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para transacciones fiscales (ARCA integration)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('invoice', 'receipt', 'credit_note')),
  arca_reference VARCHAR(50) UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  issued_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  pdf_url TEXT,
  xml_content TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mejorar tabla agencies con configuración fiscal ARCA
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS fiscal_config JSONB;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS arca_api_key TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS arca_cert_path TEXT;
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

-- Mejorar tabla clients con campos para IA y enriquecimiento
ALTER TABLE clients ADD COLUMN IF NOT EXISTS enriched_data JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lead_score DECIMAL(3, 2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3, 2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE;

-- Mejorar tabla bookings con campos adicionales
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS net_amount DECIMAL(10, 2);

-- Índices para optimización de búsquedas vectoriales
CREATE INDEX IF NOT EXISTS idx_document_sections_embedding ON document_sections USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_base_embedding ON ai_knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_clients_agency_id ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_bookings_agency_id ON bookings(agency_id);
CREATE INDEX IF NOT EXISTS idx_itineraries_agency_id ON itineraries(agency_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_agency_id ON video_sessions(agency_id);
CREATE INDEX IF NOT EXISTS idx_transactions_agency_id ON transactions(agency_id);

-- Políticas RLS estrictas para aislamiento por agencia
-- (Estas ya están parcialmente configuradas, pero las reforzamos)

-- Función helper para verificar agencia del usuario
CREATE OR REPLACE FUNCTION auth.agency_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT agency_id FROM profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::UUID
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Políticas RLS actualizadas (las existentes ya están bien configuradas)

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de updated_at
DROP TRIGGER IF EXISTS update_agencies_updated_at ON agencies;
CREATE TRIGGER update_agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_itineraries_updated_at ON itineraries;
CREATE TRIGGER update_itineraries_updated_at
  BEFORE UPDATE ON itineraries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_video_sessions_updated_at ON video_sessions;
CREATE TRIGGER update_video_sessions_updated_at
  BEFORE UPDATE ON video_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_knowledge_base_updated_at ON ai_knowledge_base;
CREATE TRIGGER update_ai_knowledge_base_updated_at
  BEFORE UPDATE ON ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios en tablas para documentación
COMMENT ON TABLE tax_perceptions IS 'Percepciones fiscales argentinas (Imp. PAIS y Ganancias)';
COMMENT ON TABLE ai_knowledge_base IS 'Base de conocimientos para sistema RAG';
COMMENT ON TABLE video_sessions IS 'Sesiones de videollamadas con análisis de sentimiento';
COMMENT ON TABLE transactions IS 'Transacciones fiscales integradas con ARCA/AFIP';
COMMENT ON COLUMN agencies.fiscal_config IS 'Configuración fiscal ARCA (CUIT, certificados, etc.)';
COMMENT ON COLUMN clients.enriched_data IS 'Datos enriquecidos por IA (LinkedIn, preferencias, etc.)';
COMMENT ON COLUMN clients.lead_score IS 'Puntuación de lead calculada por IA';
COMMENT ON COLUMN clients.sentiment_score IS 'Puntuación de sentimiento en interacciones';
