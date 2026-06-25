-- Migration: Create LLM Settings, AI Research Reports, and LLM Usage Logs tables

CREATE TABLE IF NOT EXISTS llm_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    api_key TEXT,
    base_url TEXT DEFAULT 'https://openrouter.ai/api/v1',
    default_model VARCHAR(255),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_research_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID,
    customer_id UUID,
    website_url TEXT,
    gmb_url TEXT,
    model_used VARCHAR(255),
    report JSONB,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS llm_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    model VARCHAR(255),
    operation VARCHAR(100),
    prompt_tokens INT,
    completion_tokens INT,
    total_tokens INT,
    estimated_cost DECIMAL(12,6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: Ensure that the InsForge / PostgreSQL role permissions are set accordingly
-- if row-level security (RLS) is enabled in this database.
