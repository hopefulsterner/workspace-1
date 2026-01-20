import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { 
  StateGraph, 
  END, 
  START,
  Annotation,
  MessagesAnnotation,
} from '@langchain/langgraph';
import { 
  HumanMessage, 
  SystemMessage, 
  AIMessage, 
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { LoggerService } from '../../common/services/logger.service';

// ============== State Annotations ==============

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  currentAgent: Annotation<string>({
    reducer: (_, y) => y,
  }),
  projectContext: Annotation<string>({
    reducer: (_, y) => y,
  }),
  fileOperations: Annotation<FileOperation[]>({
    reducer: (x, y) => x.concat(y),
  }),
  terminalCommands: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
  }),
  iteration: Annotation<number>({
    reducer: (x, y) => y,
  }),
});

// ============== Types ==============

export interface FileOperation {
  type: 'create' | 'edit' | 'delete';
  path: string;
  content?: string;
  oldContent?: string;
}

export interface GraphConfig {
  maxIterations?: number;
  projectContext?: string;
  provider?: 'openai' | 'anthropic';
  enableTools?: boolean;
}

type AgentStateType = typeof AgentState.State;

// ============== Tools ==============

class FileCreateTool extends StructuredTool {
  name = 'create_file';
  description = 'Create a new file with the specified content';
  schema = z.object({
    path: z.string().describe('File path relative to project root'),
    content: z.string().describe('File content'),
  });

  async _call({ path, content }: z.infer<typeof this.schema>): Promise<string> {
    return JSON.stringify({ type: 'create', path, content });
  }
}

class FileEditTool extends StructuredTool {
  name = 'edit_file';
  description = 'Edit an existing file';
  schema = z.object({
    path: z.string().describe('File path relative to project root'),
    content: z.string().describe('New file content'),
  });

  async _call({ path, content }: z.infer<typeof this.schema>): Promise<string> {
    return JSON.stringify({ type: 'edit', path, content });
  }
}

class FileDeleteTool extends StructuredTool {
  name = 'delete_file';
  description = 'Delete a file';
  schema = z.object({
    path: z.string().describe('File path relative to project root'),
  });

  async _call({ path }: z.infer<typeof this.schema>): Promise<string> {
    return JSON.stringify({ type: 'delete', path });
  }
}

class TerminalTool extends StructuredTool {
  name = 'run_terminal';
  description = 'Execute a terminal command';
  schema = z.object({
    command: z.string().describe('Command to execute'),
  });

  async _call({ command }: z.infer<typeof this.schema>): Promise<string> {
    return JSON.stringify({ type: 'terminal', command });
  }
}

class SearchCodeTool extends StructuredTool {
  name = 'search_code';
  description = 'Search for code patterns in the project';
  schema = z.object({
    query: z.string().describe('Search query'),
    filePattern: z.string().optional().describe('File pattern to filter'),
  });

  async _call({ query, filePattern }: z.infer<typeof this.schema>): Promise<string> {
    return JSON.stringify({ type: 'search', query, filePattern });
  }
}

// ============== Service ==============

@Injectable()
export class LangGraphService implements OnModuleInit {
  private openaiModel: ChatOpenAI | null = null;
  private anthropicModel: ChatAnthropic | null = null;
  private tools: StructuredTool[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('LangGraphService');
  }

  async onModuleInit() {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey) {
      this.openaiModel = new ChatOpenAI({
        openAIApiKey: openaiKey,
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.7,
      });
      this.logger.log('OpenAI model initialized for LangGraph');
    }

    if (anthropicKey) {
      this.anthropicModel = new ChatAnthropic({
        anthropicApiKey: anthropicKey,
        modelName: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
      });
      this.logger.log('Anthropic model initialized for LangGraph');
    }

    // Initialize tools
    this.tools = [
      new FileCreateTool(),
      new FileEditTool(),
      new FileDeleteTool(),
      new TerminalTool(),
      new SearchCodeTool(),
    ];
  }

  // ============== Multi-Agent Workflow ==============

  createMultiAgentWorkflow(config: GraphConfig = {}) {
    const model = this.getModel(config.provider || 'openai');
    if (!model) {
      throw new Error('No AI model available');
    }

    const boundModel = config.enableTools !== false 
      ? model.bindTools(this.tools)
      : model;

    // Define agent nodes
    const orchestratorNode = async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
      const systemPrompt = `You are the Orchestrator Agent for an AI-powered IDE.
Your role is to analyze user requests and decide how to handle them.

Available specialized agents:
- code-gen: For creating new code
- refactor: For improving existing code
- debug: For finding and fixing bugs
- test: For writing tests
- deploy: For deployment tasks

If the task is simple, handle it directly.
If it needs specialization, delegate by responding with: DELEGATE:agent-name

Current context: ${state.projectContext || 'No project context'}`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...state.messages,
      ];

      const response = await boundModel.invoke(messages);
      const content = typeof response.content === 'string' ? response.content : '';

      // Check for delegation
      const delegateMatch = content.match(/DELEGATE:(\w+)/);
      if (delegateMatch) {
        return {
          messages: [response],
          currentAgent: delegateMatch[1],
          iteration: state.iteration + 1,
        };
      }

      return {
        messages: [response],
        currentAgent: 'done',
        iteration: state.iteration + 1,
      };
    };

    const codeGenNode = async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
      const systemPrompt = `You are the Code Generation Agent. 
Create clean, well-documented, production-ready code.
Use the available tools to create files.
Follow best practices for the language/framework.

Context: ${state.projectContext || 'No context'}`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...state.messages,
      ];

      const response = await boundModel.invoke(messages);
      
      // Process tool calls
      const fileOps = this.processToolCalls(response);

      return {
        messages: [response],
        fileOperations: fileOps,
        currentAgent: 'orchestrator',
        iteration: state.iteration + 1,
      };
    };

    const refactorNode = async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
      const systemPrompt = `You are the Refactoring Agent.
Improve code quality without changing functionality.
Focus on: readability, performance, maintainability, DRY.

Context: ${state.projectContext || 'No context'}`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...state.messages,
      ];

      const response = await boundModel.invoke(messages);
      const fileOps = this.processToolCalls(response);

      return {
        messages: [response],
        fileOperations: fileOps,
        currentAgent: 'orchestrator',
        iteration: state.iteration + 1,
      };
    };

    const debugNode = async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
      const systemPrompt = `You are the Debug Agent.
Analyze code to find and fix bugs.
Explain your debugging process step by step.

Context: ${state.projectContext || 'No context'}`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...state.messages,
      ];

      const response = await boundModel.invoke(messages);
      const fileOps = this.processToolCalls(response);

      return {
        messages: [response],
        fileOperations: fileOps,
        currentAgent: 'orchestrator',
        iteration: state.iteration + 1,
      };
    };

    const testNode = async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
      const systemPrompt = `You are the Test Agent.
Write comprehensive tests for code.
Include unit tests, edge cases, and integration tests.

Context: ${state.projectContext || 'No context'}`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...state.messages,
      ];

      const response = await boundModel.invoke(messages);
      const fileOps = this.processToolCalls(response);

      return {
        messages: [response],
        fileOperations: fileOps,
        currentAgent: 'orchestrator',
        iteration: state.iteration + 1,
      };
    };

    const deployNode = async (state: AgentStateType): Promise<Partial<AgentStateType>> => {
      const systemPrompt = `You are the Deploy Agent.
Handle deployment configurations and CI/CD pipelines.
Create Dockerfiles, compose files, and deployment scripts.

Context: ${state.projectContext || 'No context'}`;

      const messages = [
        new SystemMessage(systemPrompt),
        ...state.messages,
      ];

      const response = await boundModel.invoke(messages);
      const fileOps = this.processToolCalls(response);
      const commands = this.processTerminalCommands(response);

      return {
        messages: [response],
        fileOperations: fileOps,
        terminalCommands: commands,
        currentAgent: 'orchestrator',
        iteration: state.iteration + 1,
      };
    };

    // Router function
    const router = (state: AgentStateType): string => {
      if (state.iteration >= (config.maxIterations || 10)) {
        return END;
      }

      switch (state.currentAgent) {
        case 'code-gen':
          return 'code_gen';
        case 'refactor':
          return 'refactor';
        case 'debug':
          return 'debug';
        case 'test':
          return 'test';
        case 'deploy':
          return 'deploy';
        case 'done':
          return END;
        default:
          return 'orchestrator';
      }
    };

    // Build graph
    const workflow = new StateGraph(AgentState)
      .addNode('orchestrator', orchestratorNode)
      .addNode('code_gen', codeGenNode)
      .addNode('refactor', refactorNode)
      .addNode('debug', debugNode)
      .addNode('test', testNode)
      .addNode('deploy', deployNode)
      .addEdge(START, 'orchestrator')
      .addConditionalEdges('orchestrator', router)
      .addConditionalEdges('code_gen', router)
      .addConditionalEdges('refactor', router)
      .addConditionalEdges('debug', router)
      .addConditionalEdges('test', router)
      .addConditionalEdges('deploy', router);

    return workflow.compile();
  }

  // ============== Code Review Workflow ==============

  createCodeReviewWorkflow(config: GraphConfig = {}) {
    const model = this.getModel(config.provider || 'openai');
    if (!model) {
      throw new Error('No AI model available');
    }

    const ReviewState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
      code: Annotation<string>({
        reducer: (_, y) => y,
      }),
      issues: Annotation<ReviewIssue[]>({
        reducer: (x, y) => x.concat(y),
      }),
      suggestions: Annotation<string[]>({
        reducer: (x, y) => x.concat(y),
      }),
      score: Annotation<number>({
        reducer: (_, y) => y,
      }),
      phase: Annotation<string>({
        reducer: (_, y) => y,
      }),
    });

    type ReviewStateType = typeof ReviewState.State;

    const securityReviewNode = async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      const prompt = `Analyze the following code for security vulnerabilities:
- SQL injection
- XSS vulnerabilities  
- Authentication/authorization issues
- Sensitive data exposure
- Input validation problems

Code:
${state.code}

List any security issues found.`;

      const response = await model.invoke([new HumanMessage(prompt)]);
      const content = typeof response.content === 'string' ? response.content : '';
      
      const issues = this.parseIssues(content, 'security');

      return {
        messages: [response],
        issues,
        phase: 'performance',
      };
    };

    const performanceReviewNode = async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      const prompt = `Analyze the following code for performance issues:
- Inefficient algorithms
- Memory leaks
- N+1 queries
- Unnecessary computations
- Missing caching opportunities

Code:
${state.code}

List any performance issues found.`;

      const response = await model.invoke([new HumanMessage(prompt)]);
      const content = typeof response.content === 'string' ? response.content : '';
      
      const issues = this.parseIssues(content, 'performance');

      return {
        messages: [response],
        issues,
        phase: 'style',
      };
    };

    const styleReviewNode = async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      const prompt = `Analyze the following code for style and best practices:
- Code organization
- Naming conventions
- Documentation
- Error handling
- Type safety

Code:
${state.code}

List any style issues and suggestions.`;

      const response = await model.invoke([new HumanMessage(prompt)]);
      const content = typeof response.content === 'string' ? response.content : '';
      
      const issues = this.parseIssues(content, 'style');

      return {
        messages: [response],
        issues,
        phase: 'summary',
      };
    };

    const summaryNode = async (state: ReviewStateType): Promise<Partial<ReviewStateType>> => {
      const issueCount = state.issues.length;
      const securityIssues = state.issues.filter(i => i.category === 'security').length;
      const perfIssues = state.issues.filter(i => i.category === 'performance').length;
      
      // Calculate score (100 - penalty)
      let score = 100;
      score -= securityIssues * 15; // Heavy penalty for security
      score -= perfIssues * 10;
      score -= (issueCount - securityIssues - perfIssues) * 5;
      score = Math.max(0, Math.min(100, score));

      const summary = `Code Review Summary:
- Total Issues: ${issueCount}
- Security Issues: ${securityIssues}
- Performance Issues: ${perfIssues}
- Style Issues: ${issueCount - securityIssues - perfIssues}
- Overall Score: ${score}/100`;

      return {
        messages: [new AIMessage(summary)],
        score,
        phase: 'done',
      };
    };

    const router = (state: ReviewStateType): string => {
      switch (state.phase) {
        case 'performance':
          return 'performance';
        case 'style':
          return 'style';
        case 'summary':
          return 'summary';
        case 'done':
          return END;
        default:
          return 'security';
      }
    };

    const workflow = new StateGraph(ReviewState)
      .addNode('security', securityReviewNode)
      .addNode('performance', performanceReviewNode)
      .addNode('style', styleReviewNode)
      .addNode('summary', summaryNode)
      .addEdge(START, 'security')
      .addConditionalEdges('security', router)
      .addConditionalEdges('performance', router)
      .addConditionalEdges('style', router)
      .addEdge('summary', END);

    return workflow.compile();
  }

  // ============== Simple Agent Execution ==============

  async runAgent(
    message: string,
    config: GraphConfig = {},
  ): Promise<{ response: string; operations: FileOperation[]; commands: string[] }> {
    const workflow = this.createMultiAgentWorkflow(config);

    const initialState = {
      messages: [new HumanMessage(message)],
      currentAgent: 'orchestrator',
      projectContext: config.projectContext || '',
      fileOperations: [],
      terminalCommands: [],
      iteration: 0,
    };

    const result = await workflow.invoke(initialState);

    // Get last AI message
    const lastMessage = result.messages
      .filter((m: BaseMessage) => m._getType() === 'ai')
      .pop();

    const response = lastMessage
      ? (typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content))
      : '';

    return {
      response,
      operations: result.fileOperations || [],
      commands: result.terminalCommands || [],
    };
  }

  // ============== Streaming Agent ==============

  async *streamAgent(
    message: string,
    config: GraphConfig = {},
  ): AsyncGenerator<{ type: string; data: any }> {
    const workflow = this.createMultiAgentWorkflow(config);

    const initialState = {
      messages: [new HumanMessage(message)],
      currentAgent: 'orchestrator',
      projectContext: config.projectContext || '',
      fileOperations: [],
      terminalCommands: [],
      iteration: 0,
    };

    for await (const chunk of await workflow.stream(initialState)) {
      for (const [node, state] of Object.entries(chunk)) {
        const typedState = state as Partial<AgentStateType>;
        yield {
          type: 'node',
          data: {
            node,
            agent: typedState.currentAgent,
            iteration: typedState.iteration,
          },
        };

        if (typedState.messages) {
          for (const msg of typedState.messages) {
            if (msg._getType() === 'ai') {
              yield {
                type: 'message',
                data: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              };
            }
          }
        }

        if (typedState.fileOperations && typedState.fileOperations.length > 0) {
          yield {
            type: 'operations',
            data: typedState.fileOperations,
          };
        }
      }
    }

    yield { type: 'done', data: null };
  }

  // ============== Helpers ==============

  private getModel(provider: 'openai' | 'anthropic'): ChatOpenAI | ChatAnthropic | null {
    if (provider === 'anthropic' && this.anthropicModel) {
      return this.anthropicModel;
    }
    return this.openaiModel;
  }

  private processToolCalls(response: any): FileOperation[] {
    const operations: FileOperation[] = [];

    if (response.tool_calls) {
      for (const call of response.tool_calls) {
        try {
          const result = JSON.parse(call.args || '{}');
          if (result.type && result.path) {
            operations.push(result as FileOperation);
          }
        } catch {
          // Ignore invalid tool calls
        }
      }
    }

    return operations;
  }

  private processTerminalCommands(response: any): string[] {
    const commands: string[] = [];

    if (response.tool_calls) {
      for (const call of response.tool_calls) {
        if (call.name === 'run_terminal') {
          try {
            const result = JSON.parse(call.args || '{}');
            if (result.command) {
              commands.push(result.command);
            }
          } catch {
            // Ignore invalid calls
          }
        }
      }
    }

    return commands;
  }

  private parseIssues(content: string, category: string): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.match(/^[-*•]\s+/)) {
        issues.push({
          category,
          description: line.replace(/^[-*•]\s+/, ''),
          severity: this.guessSeverity(line),
        });
      }
    }

    return issues;
  }

  private guessSeverity(text: string): 'high' | 'medium' | 'low' {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('critical') || lowerText.includes('vulnerability') || lowerText.includes('security')) {
      return 'high';
    }
    if (lowerText.includes('should') || lowerText.includes('recommended')) {
      return 'medium';
    }
    return 'low';
  }
}

interface ReviewIssue {
  category: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}
