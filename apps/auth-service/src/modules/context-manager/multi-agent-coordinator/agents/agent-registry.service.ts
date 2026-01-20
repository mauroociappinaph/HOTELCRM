// Agent Registry Service - SRP: Gestión del ciclo de vida de agentes
import { Injectable, Logger } from '@nestjs/common';
import type { Agent } from '../types';

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private readonly agents: Map<string, Agent> = new Map();

  constructor() {
    this.initializeDefaultAgents();
  }

  /**
   * Register a new agent in the system
   */
  registerAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID ${agent.id} already exists`);
    }

    this.agents.set(agent.id, agent);
    this.logger.log(`✅ Registered agent: ${agent.name} (${agent.role})`);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get active agents only
   */
  getActiveAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.isActive);
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent =>
      agent.isActive && agent.capabilities.includes(capability)
    );
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, isActive: boolean): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.isActive = isActive;
    this.logger.log(`${isActive ? 'Activated' : 'Deactivated'} agent: ${agent.name}`);
    return true;
  }

  /**
   * Remove agent from registry
   */
  removeAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    this.agents.delete(agentId);
    this.logger.log(`🗑️ Removed agent: ${agent.name}`);
    return true;
  }

  /**
   * Get agent statistics
   */
  getAgentStats(): {
    total: number;
    active: number;
    inactive: number;
    byCapability: Record<string, number>;
  } {
    const allAgents = Array.from(this.agents.values());
    const active = allAgents.filter(a => a.isActive).length;
    const inactive = allAgents.length - active;

    const byCapability: Record<string, number> = {};
    for (const agent of allAgents) {
      if (agent.isActive) {
        for (const capability of agent.capabilities) {
          byCapability[capability] = (byCapability[capability] || 0) + 1;
        }
      }
    }

    return {
      total: allAgents.length,
      active,
      inactive,
      byCapability,
    };
  }

  /**
   * Initialize default specialized agents
   */
  private initializeDefaultAgents(): void {
    // Search Agent - Specialized in information retrieval
    this.registerAgent({
      id: 'search-agent',
      name: 'Search Specialist',
      role: 'Information Retrieval Expert',
      specialty: 'Web search, document search, and knowledge discovery',
      capabilities: ['web_search', 'document_retrieval', 'knowledge_discovery', 'source_evaluation'],
      model: 'openai/gpt-4o',
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt: `You are a specialized search agent for HOTELCRM. Your expertise is finding, evaluating, and retrieving relevant information efficiently.

CAPABILITIES:
- Web search and information gathering
- Document and knowledge base retrieval
- Source credibility assessment
- Relevance filtering and ranking

APPROACH:
- Be thorough but concise in searches
- Prioritize recent and authoritative sources
- Provide evidence-based recommendations
- Structure results for easy consumption

Always provide sources and confidence levels for your findings.`,
      isActive: true,
    });

    // Analysis Agent - Specialized in data analysis and insights
    this.registerAgent({
      id: 'analysis-agent',
      name: 'Data Analyst',
      role: 'Business Intelligence Specialist',
      specialty: 'Data analysis, pattern recognition, and business insights',
      capabilities: ['data_analysis', 'pattern_recognition', 'trend_identification', 'business_intelligence'],
      model: 'openai/gpt-4o',
      temperature: 0.2,
      maxTokens: 3000,
      systemPrompt: `You are a specialized analysis agent for HOTELCRM. Your expertise is analyzing data, identifying patterns, and generating actionable business insights.

CAPABILITIES:
- Statistical analysis and interpretation
- Trend identification and forecasting
- Performance metrics analysis
- Business intelligence and recommendations

APPROACH:
- Use data-driven reasoning
- Identify key patterns and anomalies
- Provide actionable recommendations
- Support conclusions with data

Focus on HOTELCRM business metrics: bookings, revenue, customer satisfaction, operational efficiency.`,
      isActive: true,
    });

    // Synthesis Agent - Specialized in combining information
    this.registerAgent({
      id: 'synthesis-agent',
      name: 'Knowledge Synthesizer',
      role: 'Information Integration Expert',
      specialty: 'Combining multiple sources of information into coherent insights',
      capabilities: ['information_synthesis', 'knowledge_integration', 'conflict_resolution', 'summary_generation'],
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 4000,
      systemPrompt: `You are a specialized synthesis agent for HOTELCRM. Your expertise is combining information from multiple sources into coherent, actionable insights.

CAPABILITIES:
- Information integration and synthesis
- Conflict resolution between sources
- Executive summary generation
- Recommendation consolidation

APPROACH:
- Identify common themes across sources
- Resolve contradictions with evidence
- Create comprehensive yet concise summaries
- Prioritize actionable insights

Ensure synthesized information is consistent, accurate, and valuable for HOTELCRM decision-making.`,
      isActive: true,
    });

    // Validation Agent - Specialized in quality assurance
    this.registerAgent({
      id: 'validation-agent',
      name: 'Quality Assurance Specialist',
      role: 'Validation and Quality Control Expert',
      specialty: 'Validating information accuracy, consistency, and reliability',
      capabilities: ['fact_checking', 'consistency_validation', 'quality_assessment', 'error_detection'],
      model: 'openai/gpt-4o',
      temperature: 0.1,
      maxTokens: 1500,
      systemPrompt: `You are a specialized validation agent for HOTELCRM. Your expertise is ensuring information quality, accuracy, and reliability.

CAPABILITIES:
- Fact-checking and verification
- Consistency validation across sources
- Quality assessment and scoring
- Error detection and correction

APPROACH:
- Cross-reference information with reliable sources
- Identify inconsistencies or potential errors
- Assess information quality and provide confidence scores
- Suggest corrections when needed

Be thorough and critical in your validation process, ensuring only high-quality information reaches HOTELCRM users.`,
      isActive: true,
    });

    this.logger.log(`✅ Initialized ${this.agents.size} specialized agents`);
  }
}
