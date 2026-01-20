import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { 
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
} from '@langchain/core/prompts';
import { 
  RunnableSequence,
  RunnablePassthrough,
  RunnableLambda,
  RunnableMap,
} from '@langchain/core/runnables';
import { StringOutputParser, JsonOutputParser } from '@langchain/core/output_parsers';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { LoggerService } from '../../common/services/logger.service';

// ============== Types ==============

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userTemplate: string;
  variables: string[];
  category: PromptCategory;
  version: number;
  metadata?: Record<string, any>;
}

export type PromptCategory = 
  | 'code-generation'
  | 'code-review'
  | 'documentation'
  | 'debugging'
  | 'testing'
  | 'refactoring'
  | 'explanation'
  | 'conversation'
  | 'custom';

export interface PromptExecutionResult {
  output: string;
  templateId: string;
  variables: Record<string, any>;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latencyMs: number;
}

export interface ChainConfig {
  steps: ChainStep[];
  parallel?: boolean;
  stopOnError?: boolean;
}

export interface ChainStep {
  name: string;
  templateId?: string;
  customPrompt?: string;
  inputMapping?: Record<string, string>;
  outputKey?: string;
  condition?: (input: any) => boolean;
}

// ============== Default Prompt Templates ==============

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'code-gen-react',
    name: 'React Component Generator',
    description: 'Generate React components with TypeScript and Tailwind',
    systemPrompt: `You are an expert React developer. Create clean, well-documented React components.
Rules:
1. Use TypeScript with proper type definitions
2. Use Tailwind CSS for styling
3. Follow React best practices (hooks, composition)
4. Include proper error handling
5. Add JSDoc comments for components and props`,
    userTemplate: `Create a React component for: {description}

Requirements:
- Component name: {componentName}
- Props: {props}
- Features: {features}

{additionalContext}`,
    variables: ['description', 'componentName', 'props', 'features', 'additionalContext'],
    category: 'code-generation',
    version: 1,
  },
  {
    id: 'code-gen-api',
    name: 'API Endpoint Generator',
    description: 'Generate REST or GraphQL API endpoints',
    systemPrompt: `You are an expert backend developer. Create production-ready API endpoints.
Rules:
1. Include input validation
2. Proper error handling with appropriate status codes
3. TypeScript types for request/response
4. Authentication/authorization checks where needed
5. Follow REST best practices`,
    userTemplate: `Create an API endpoint for: {description}

Method: {method}
Path: {path}
Authentication: {auth}
Request body: {requestBody}
Response format: {responseFormat}`,
    variables: ['description', 'method', 'path', 'auth', 'requestBody', 'responseFormat'],
    category: 'code-generation',
    version: 1,
  },
  {
    id: 'code-review',
    name: 'Code Review Assistant',
    description: 'Review code for quality, security, and best practices',
    systemPrompt: `You are a senior code reviewer. Provide constructive, actionable feedback.
Focus on:
1. Security vulnerabilities
2. Performance issues
3. Code readability and maintainability
4. Best practices and design patterns
5. Error handling
6. Type safety

Format your review with clear sections and severity levels (Critical, Warning, Suggestion).`,
    userTemplate: `Review the following {language} code:

\`\`\`{language}
{code}
\`\`\`

Context: {context}
Focus areas: {focusAreas}`,
    variables: ['language', 'code', 'context', 'focusAreas'],
    category: 'code-review',
    version: 1,
  },
  {
    id: 'debug-assistant',
    name: 'Debug Assistant',
    description: 'Help debug issues in code',
    systemPrompt: `You are an expert debugger. Analyze code and errors to identify root causes.
Approach:
1. Understand the expected behavior
2. Identify the actual behavior  
3. Analyze the code path
4. Identify potential causes
5. Suggest fixes with explanations

Be systematic and explain your reasoning.`,
    userTemplate: `Debug this issue:

Error message: {errorMessage}

Code:
\`\`\`{language}
{code}
\`\`\`

Expected behavior: {expectedBehavior}
Actual behavior: {actualBehavior}
Additional context: {context}`,
    variables: ['errorMessage', 'language', 'code', 'expectedBehavior', 'actualBehavior', 'context'],
    category: 'debugging',
    version: 1,
  },
  {
    id: 'test-generator',
    name: 'Test Generator',
    description: 'Generate unit tests for code',
    systemPrompt: `You are a testing expert. Write comprehensive tests that ensure code reliability.
Include:
1. Happy path tests
2. Edge cases
3. Error handling tests
4. Boundary conditions
5. Mock external dependencies

Use {framework} testing framework conventions.`,
    userTemplate: `Generate tests for this code:

\`\`\`{language}
{code}
\`\`\`

Test framework: {framework}
Focus on: {focusAreas}
Mocking requirements: {mocking}`,
    variables: ['language', 'code', 'framework', 'focusAreas', 'mocking'],
    category: 'testing',
    version: 1,
  },
  {
    id: 'documentation',
    name: 'Documentation Generator',
    description: 'Generate documentation for code',
    systemPrompt: `You are a technical writer. Create clear, comprehensive documentation.
Include:
1. Overview and purpose
2. Installation/setup instructions
3. Usage examples
4. API reference
5. Configuration options
6. Troubleshooting

Use proper Markdown formatting.`,
    userTemplate: `Generate documentation for:

{codeOrDescription}

Documentation type: {docType}
Target audience: {audience}
Include examples: {includeExamples}`,
    variables: ['codeOrDescription', 'docType', 'audience', 'includeExamples'],
    category: 'documentation',
    version: 1,
  },
  {
    id: 'explain-code',
    name: 'Code Explainer',
    description: 'Explain code in plain language',
    systemPrompt: `You are a patient teacher. Explain code clearly at the appropriate level.
Adjust complexity based on the audience level.
Use analogies and examples where helpful.
Break down complex concepts into digestible pieces.`,
    userTemplate: `Explain this code:

\`\`\`{language}
{code}
\`\`\`

Audience level: {audienceLevel}
Focus on: {focus}
Explain: {specificQuestions}`,
    variables: ['language', 'code', 'audienceLevel', 'focus', 'specificQuestions'],
    category: 'explanation',
    version: 1,
  },
  {
    id: 'refactor',
    name: 'Code Refactoring',
    description: 'Refactor code for better quality',
    systemPrompt: `You are a refactoring expert. Improve code without changing behavior.
Focus on:
1. Readability and clarity
2. Performance optimization
3. Reducing complexity
4. Applying design patterns
5. Following SOLID principles
6. DRY (Don't Repeat Yourself)

Explain each change and why it improves the code.`,
    userTemplate: `Refactor this code:

\`\`\`{language}
{code}
\`\`\`

Goals: {goals}
Constraints: {constraints}
Priority: {priority}`,
    variables: ['language', 'code', 'goals', 'constraints', 'priority'],
    category: 'refactoring',
    version: 1,
  },
];

// ============== Service ==============

@Injectable()
export class PromptOrchestrationService implements OnModuleInit {
  private templates: Map<string, PromptTemplate> = new Map();
  private openaiModel: ChatOpenAI | null = null;
  private anthropicModel: ChatAnthropic | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('PromptOrchestrationService');
  }

  async onModuleInit() {
    // Load default templates
    for (const template of DEFAULT_TEMPLATES) {
      this.templates.set(template.id, template);
    }
    this.logger.log(`Loaded ${this.templates.size} default prompt templates`);

    // Initialize models
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey) {
      this.openaiModel = new ChatOpenAI({
        openAIApiKey: openaiKey,
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.7,
      });
    }

    if (anthropicKey) {
      this.anthropicModel = new ChatAnthropic({
        anthropicApiKey: anthropicKey,
        modelName: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
      });
    }
  }

  // ============== Template Management ==============

  registerTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    this.logger.log(`Registered template: ${template.id}`);
  }

  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  listTemplates(category?: PromptCategory): PromptTemplate[] {
    const templates = Array.from(this.templates.values());
    if (category) {
      return templates.filter(t => t.category === category);
    }
    return templates;
  }

  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  // ============== Single Prompt Execution ==============

  async executeTemplate(
    templateId: string,
    variables: Record<string, any>,
    options?: {
      provider?: 'openai' | 'anthropic';
      temperature?: number;
      maxTokens?: number;
      history?: BaseMessage[];
    },
  ): Promise<PromptExecutionResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const startTime = Date.now();

    // Build the prompt
    const systemMessage = template.systemPrompt;
    let userMessage = template.userTemplate;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      userMessage = userMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value?.toString() || '');
    }

    // Clean up unused variables
    userMessage = userMessage.replace(/\{[\w]+\}/g, '');

    // Get model
    const model = this.getModel(options?.provider || 'openai');
    if (!model) {
      throw new Error('No AI model available');
    }

    // Configure model
    if (options?.temperature !== undefined) {
      model.temperature = options.temperature;
    }

    // Build messages
    const messages: BaseMessage[] = [
      new SystemMessage(systemMessage),
    ];

    if (options?.history) {
      messages.push(...options.history);
    }

    messages.push(new HumanMessage(userMessage));

    // Execute
    const response = await model.invoke(messages);
    const output = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    return {
      output,
      templateId,
      variables,
      latencyMs: Date.now() - startTime,
    };
  }

  // ============== Chain Execution ==============

  async executeChain(
    config: ChainConfig,
    initialInput: Record<string, any>,
    options?: {
      provider?: 'openai' | 'anthropic';
    },
  ): Promise<Record<string, any>> {
    const model = this.getModel(options?.provider || 'openai');
    if (!model) {
      throw new Error('No AI model available');
    }

    let context = { ...initialInput };

    for (const step of config.steps) {
      // Check condition
      if (step.condition && !step.condition(context)) {
        continue;
      }

      // Map inputs
      const stepInput: Record<string, any> = {};
      if (step.inputMapping) {
        for (const [target, source] of Object.entries(step.inputMapping)) {
          stepInput[target] = this.resolveValue(source, context);
        }
      } else {
        Object.assign(stepInput, context);
      }

      // Execute step
      let output: string;
      if (step.templateId) {
        const result = await this.executeTemplate(step.templateId, stepInput, options);
        output = result.output;
      } else if (step.customPrompt) {
        const response = await model.invoke([
          new HumanMessage(this.interpolate(step.customPrompt, stepInput)),
        ]);
        output = typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
      } else {
        throw new Error(`Step ${step.name} has no template or prompt`);
      }

      // Store output
      const outputKey = step.outputKey || step.name;
      context[outputKey] = output;
    }

    return context;
  }

  // ============== Parallel Execution ==============

  async executeParallel(
    templateIds: string[],
    sharedVariables: Record<string, any>,
    options?: {
      provider?: 'openai' | 'anthropic';
    },
  ): Promise<Map<string, PromptExecutionResult>> {
    const results = new Map<string, PromptExecutionResult>();

    const promises = templateIds.map(async (templateId) => {
      const result = await this.executeTemplate(templateId, sharedVariables, options);
      return { templateId, result };
    });

    const settled = await Promise.allSettled(promises);

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.set(outcome.value.templateId, outcome.value.result);
      }
    }

    return results;
  }

  // ============== Streaming Execution ==============

  async *streamTemplate(
    templateId: string,
    variables: Record<string, any>,
    options?: {
      provider?: 'openai' | 'anthropic';
      history?: BaseMessage[];
    },
  ): AsyncGenerator<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const model = this.getModel(options?.provider || 'openai');
    if (!model) {
      throw new Error('No AI model available');
    }

    // Build prompt
    let userMessage = template.userTemplate;
    for (const [key, value] of Object.entries(variables)) {
      userMessage = userMessage.replace(new RegExp(`\\{${key}\\}`, 'g'), value?.toString() || '');
    }

    const messages: BaseMessage[] = [
      new SystemMessage(template.systemPrompt),
    ];

    if (options?.history) {
      messages.push(...options.history);
    }

    messages.push(new HumanMessage(userMessage));

    // Stream response
    const stream = await model.stream(messages);

    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string' ? chunk.content : '';
      if (content) {
        yield content;
      }
    }
  }

  // ============== Dynamic Prompt Building ==============

  buildPrompt(config: {
    systemPrompt: string;
    userTemplate: string;
    variables: Record<string, any>;
    outputFormat?: 'text' | 'json' | 'markdown';
    constraints?: string[];
    examples?: Array<{ input: string; output: string }>;
  }): { system: string; user: string } {
    let system = config.systemPrompt;
    let user = config.userTemplate;

    // Add output format instructions
    if (config.outputFormat === 'json') {
      system += '\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanations.';
    } else if (config.outputFormat === 'markdown') {
      system += '\n\nFormat your response using proper Markdown syntax.';
    }

    // Add constraints
    if (config.constraints && config.constraints.length > 0) {
      system += '\n\nConstraints:\n' + config.constraints.map(c => `- ${c}`).join('\n');
    }

    // Add examples
    if (config.examples && config.examples.length > 0) {
      system += '\n\nExamples:';
      for (const example of config.examples) {
        system += `\n\nInput: ${example.input}\nOutput: ${example.output}`;
      }
    }

    // Replace variables
    for (const [key, value] of Object.entries(config.variables)) {
      user = user.replace(new RegExp(`\\{${key}\\}`, 'g'), value?.toString() || '');
    }

    return { system, user };
  }

  // ============== Prompt Optimization ==============

  async optimizePrompt(
    originalPrompt: string,
    goal: string,
    examples?: Array<{ input: string; expectedOutput: string; actualOutput?: string }>,
  ): Promise<{ optimizedPrompt: string; changes: string[] }> {
    const model = this.getModel('openai');
    if (!model) {
      throw new Error('No AI model available');
    }

    let optimizationRequest = `Optimize this prompt for better results.

Original prompt:
${originalPrompt}

Goal: ${goal}
`;

    if (examples && examples.length > 0) {
      optimizationRequest += '\n\nExamples of expected behavior:\n';
      for (const example of examples) {
        optimizationRequest += `\nInput: ${example.input}\nExpected: ${example.expectedOutput}`;
        if (example.actualOutput) {
          optimizationRequest += `\nActual: ${example.actualOutput}`;
        }
      }
    }

    optimizationRequest += `

Provide:
1. An optimized version of the prompt
2. List of specific changes made and why

Format your response as:
OPTIMIZED PROMPT:
[optimized prompt here]

CHANGES:
- [change 1]
- [change 2]
...`;

    const response = await model.invoke([new HumanMessage(optimizationRequest)]);
    const content = typeof response.content === 'string' ? response.content : '';

    // Parse response
    const promptMatch = content.match(/OPTIMIZED PROMPT:\s*([\s\S]*?)(?=CHANGES:|$)/);
    const changesMatch = content.match(/CHANGES:\s*([\s\S]*)/);

    const optimizedPrompt = promptMatch ? promptMatch[1].trim() : originalPrompt;
    const changes = changesMatch
      ? changesMatch[1]
          .split('\n')
          .filter(line => line.trim().startsWith('-'))
          .map(line => line.replace(/^-\s*/, '').trim())
      : [];

    return { optimizedPrompt, changes };
  }

  // ============== Context Compression ==============

  async compressContext(
    context: string,
    maxTokens: number,
    preserveKeys?: string[],
  ): Promise<string> {
    const model = this.getModel('openai');
    if (!model) {
      return context.slice(0, maxTokens * 4); // Rough fallback
    }

    const preserveInstructions = preserveKeys
      ? `Important: Preserve information about: ${preserveKeys.join(', ')}`
      : '';

    const prompt = `Compress the following context to fit within approximately ${maxTokens} tokens while preserving the most important information.
${preserveInstructions}

Context:
${context}

Provide a compressed version that maintains key facts and relationships.`;

    const response = await model.invoke([new HumanMessage(prompt)]);
    return typeof response.content === 'string' ? response.content : context;
  }

  // ============== Helpers ==============

  private getModel(provider: 'openai' | 'anthropic'): ChatOpenAI | ChatAnthropic | null {
    if (provider === 'anthropic' && this.anthropicModel) {
      return this.anthropicModel;
    }
    return this.openaiModel;
  }

  private interpolate(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value?.toString() || '');
    }
    return result;
  }

  private resolveValue(path: string, context: Record<string, any>): any {
    if (path.startsWith('$')) {
      const key = path.slice(1);
      return context[key];
    }
    return path;
  }
}
