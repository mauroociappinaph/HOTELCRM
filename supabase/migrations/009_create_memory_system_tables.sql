-- Migration: Create AI Memory System Tables with RLS and Multitenancy

-- Episodic Memories (User specific interaction history)
CREATE TABLE IF NOT EXISTS episodic_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE, -- Critical for multitenancy
  session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE SET NULL,
  interaction_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  outcome VARCHAR(50),
  importance DECIMAL(3,2),
  consolidation_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Semantic Memories (Agency specific shared knowledge)
CREATE TABLE IF NOT EXISTS semantic_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE, -- Critical for multitenancy
  concept VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  facts TEXT[],
  relationships JSONB DEFAULT '[]',
  confidence DECIMAL(3,2),
  source VARCHAR(100),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  -- Ensure unique concepts per agency (not global)
  UNIQUE(agency_id, concept, category)
);

-- Procedural Memories (Agency specific task patterns)
CREATE TABLE IF NOT EXISTS procedural_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE, -- Critical for multitenancy
  task_type VARCHAR(255) NOT NULL,
  pattern TEXT,
  steps TEXT[],
  success_rate DECIMAL(3,2),
  average_duration INTEGER,
  prerequisites TEXT[],
  outcomes TEXT[],
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE episodic_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedural_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Episodic: User can only see their own memories
CREATE POLICY "Users can access their own episodic memories" ON episodic_memories
  FOR ALL USING (user_id = auth.uid());

-- Semantic: User can see memories from their agency
CREATE POLICY "Users can access their agency's semantic memories" ON semantic_memories
  FOR ALL USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- Procedural: User can see memories from their agency
CREATE POLICY "Users can access their agency's procedural memories" ON procedural_memories
  FOR ALL USING (agency_id IN (
    SELECT agency_id FROM profiles WHERE id = auth.uid()
  ));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_episodic_memories_user ON episodic_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_episodic_memories_content ON episodic_memories USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_semantic_memories_agency_concept ON semantic_memories(agency_id, concept);
CREATE INDEX IF NOT EXISTS idx_procedural_memories_agency_task ON procedural_memories(agency_id, task_type);
