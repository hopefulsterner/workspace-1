import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables';

// Agent Types
export type AgentType = 
  | 'orchestrator'
  | 'code-generation'
  | 'refactor'
  | 'debug'
  | 'test'
  | 'build'
  | 'deploy'
  | 'filesystem'
  | 'ui'
  | 'documentation';

// Agent System Prompts
const AGENT_PROMPTS: Record<AgentType, string> = {
  orchestrator: `You are the Orchestrator Agent for an AI-powered IDE.
Your role is to analyze user requests and coordinate other specialized agents.
You can delegate tasks to: code-generation, refactor, debug, test, build, deploy, filesystem, ui, documentation agents.

When a user asks something, analyze it and decide which agent(s) should handle it.
Output your delegation in this format:
<delegate agent="agent-name">specific task description</delegate>

If you can handle it yourself (simple questions, explanations), respond directly.`,

  'code-generation': `You are the Code Generation Agent.
You excel at writing clean, efficient, well-documented code.
Follow best practices for the language/framework being used.
Always include:
- Proper type annotations (for TypeScript)
- Error handling
- Comments for complex logic
- Follow project conventions

Output code using file operation tags:
<file_create path="filepath">code content</file_create>`,

  refactor: `You are the Refactor Agent.
Your specialty is improving existing code without changing its behavior.
Focus on:
- Code readability
- Performance optimization
- Design pattern application
- Reducing complexity
- DRY principle

Use <file_edit path="filepath" action="replace|insert|delete">content</file_edit>`,

  debug: `You are the Debug Agent.
You analyze code to find and fix bugs.
Your approach:
1. Understand the expected behavior
2. Identify the actual behavior
3. Trace the root cause
4. Propose and implement fixes

Explain your debugging process step by step.`,

  test: `You are the Test Agent.
You write comprehensive test suites.
Focus on:
- Unit tests
- Integration tests
- Edge cases
- Mocking external dependencies
- Test coverage

Use appropriate testing frameworks (Jest, Vitest, Pytest, etc.)`,

  build: `You are the Build Agent.
You handle project configuration and build processes.
Expertise in:
- Package.json configuration
- Webpack/Vite/Rollup configuration
- TypeScript configuration
- Docker configuration
- CI/CD pipelines`,

  deploy: `You are the Deploy Agent.
You handle deployment processes.
Expertise in:
- Docker containers
- Cloud platforms (AWS, GCP, Vercel)
- Environment configuration
- Deployment scripts
- SSL/TLS setup`,

  filesystem: `You are the File System Agent.
You manage project files and directories.
Operations:
<file_create path="filepath">content</file_create>
<file_edit path="filepath" action="replace">new content</file_edit>
<file_delete path="filepath"></file_delete>
<folder_create path="folderpath"></folder_create>

Always explain what changes you're making.`,

  ui: `You are the UI Agent.
You specialize in frontend development and UI/UX.
Expertise in:
- React components
- Tailwind CSS
- Responsive design
- Accessibility
- Animation (Framer Motion)
- State management

Create beautiful, functional, accessible interfaces.`,

  documentation: `You are the Documentation Agent.
You write clear, comprehensive documentation.
Create:
- README files
- API documentation
- Code comments
- User guides
- Architecture docs

Use proper markdown formatting.`,
};

// Base system prompt for IDE context
const IDE_CONTEXT = `You are an AI assistant integrated into an AI-powered IDE called "AI Digital Friend Zone".

You can perform file operations using XML tags:
<file_create path="filepath">file content</file_create>
<file_edit path="filepath" action="replace|insert|delete">content</file_edit>
<file_delete path="filepath"></file_delete>

You can also run terminal commands:
<terminal_command>npm install package-name</terminal_command>

Always be helpful, precise, and follow best practices for the technology being used.`;

// Create LangChain model instances
function createModel(provider: 'openai' | 'anthropic' = 'openai') {
  if (provider === 'anthropic') {
    return new ChatAnthropic({
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4096,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  
  return new ChatOpenAI({
    modelName: process.env.OPENAI_MODEL || 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
}

// Message history type
interface MessageHistory {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Agent class
class Agent {
  private model: ChatOpenAI | ChatAnthropic;
  private systemPrompt: string;
  private history: BaseMessage[] = [];

  constructor(type: AgentType, provider: 'openai' | 'anthropic' = 'openai') {
    this.model = createModel(provider);
    this.systemPrompt = `${IDE_CONTEXT}\n\n${AGENT_PROMPTS[type]}`;
  }

  async chat(message: string, context?: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(this.systemPrompt + (context ? `\n\nProject Context:\n${context}` : '')),
      ...this.history,
      new HumanMessage(message),
    ];

    const response = await this.model.invoke(messages);
    const content = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);

    // Add to history
    this.history.push(new HumanMessage(message));
    this.history.push(new AIMessage(content));

    // Keep history manageable
    if (this.history.length > 20) {
      this.history = this.history.slice(-16);
    }

    return content;
  }

  clearHistory(): void {
    this.history = [];
  }
}

// Orchestrator that manages multiple agents
class AgentOrchestrator {
  private agents: Map<AgentType, Agent> = new Map();
  private provider: 'openai' | 'anthropic';

  constructor(provider: 'openai' | 'anthropic' = 'openai') {
    this.provider = provider;
    this.agents.set('orchestrator', new Agent('orchestrator', provider));
  }

  private getOrCreateAgent(type: AgentType): Agent {
    if (!this.agents.has(type)) {
      this.agents.set(type, new Agent(type, this.provider));
    }
    return this.agents.get(type)!;
  }

  async process(message: string, projectContext?: string): Promise<string> {
    const orchestrator = this.getOrCreateAgent('orchestrator');
    
    // First, let orchestrator analyze the request
    const analysis = await orchestrator.chat(message, projectContext);
    
    // Check if delegation is needed
    const delegateMatch = analysis.match(/<delegate agent="([^"]+)">([^<]+)<\/delegate>/g);
    
    if (!delegateMatch) {
      // Orchestrator handled it directly
      return analysis;
    }

    // Process delegations
    const results: string[] = [];
    
    for (const match of delegateMatch) {
      const agentMatch = match.match(/<delegate agent="([^"]+)">([^<]+)<\/delegate>/);
      if (agentMatch) {
        const [, agentType, task] = agentMatch;
        if (this.isValidAgentType(agentType)) {
          const agent = this.getOrCreateAgent(agentType as AgentType);
          const result = await agent.chat(task, projectContext);
          results.push(`### ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent:\n${result}`);
        }
      }
    }

    return results.length > 0 ? results.join('\n\n') : analysis;
  }

  async directChat(agentType: AgentType, message: string, projectContext?: string): Promise<string> {
    const agent = this.getOrCreateAgent(agentType);
    return agent.chat(message, projectContext);
  }

  private isValidAgentType(type: string): type is AgentType {
    return Object.keys(AGENT_PROMPTS).includes(type);
  }

  clearAllHistory(): void {
    this.agents.forEach(agent => agent.clearHistory());
  }
}

// Streaming support with LangChain
async function* streamChat(
  message: string, 
  history: MessageHistory[] = [],
  provider: 'openai' | 'anthropic' = 'openai',
  projectContext?: string
): AsyncGenerator<string> {
  const model = createModel(provider);
  
  const messages: BaseMessage[] = [
    new SystemMessage(IDE_CONTEXT + (projectContext ? `\n\nProject Context:\n${projectContext}` : '')),
    ...history.map(msg => 
      msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
    ),
    new HumanMessage(message),
  ];

  const stream = await model.stream(messages);
  
  for await (const chunk of stream) {
    const content = typeof chunk.content === 'string' ? chunk.content : '';
    if (content) {
      yield content;
    }
  }
}

// Export
export const langchainService = {
  Agent,
  AgentOrchestrator,
  streamChat,
  createModel,
  AGENT_PROMPTS,
  IDE_CONTEXT,
};

export default langchainService;
