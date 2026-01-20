import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { LoggerService } from '../../common/services/logger.service';
import { VectorStoreService, SearchResult } from './vector-store.service';
import { EmbeddingsService } from './embeddings.service';

export interface RAGContext {
  sources: SearchResult[];
  query: string;
  enhancedQuery?: string;
}

export interface RAGResponse {
  answer: string;
  context: RAGContext;
  citations: Citation[];
  confidence: number;
}

export interface Citation {
  content: string;
  source: string;
  relevance: number;
}

export interface RAGConfig {
  collectionName: string;
  topK?: number;
  minScore?: number;
  reranking?: boolean;
  maxContextLength?: number;
  includeMetadata?: boolean;
  queryExpansion?: boolean;
}

@Injectable()
export class RagService {
  private model: ChatOpenAI | ChatAnthropic | null = null;

  private readonly DEFAULT_RAG_SYSTEM_PROMPT = `You are an AI assistant with access to a knowledge base.
Answer questions based on the provided context. If the context doesn't contain enough information,
say so clearly. Always cite your sources when possible.

Guidelines:
1. Use only information from the provided context
2. If context is insufficient, acknowledge it
3. Provide accurate, concise answers
4. Cite relevant sources
5. Maintain a helpful, professional tone`;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly vectorStore: VectorStoreService,
    private readonly embeddings: EmbeddingsService,
  ) {
    this.logger.setContext('RagService');
    this.initializeModel();
  }

  private initializeModel() {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey) {
      this.model = new ChatOpenAI({
        openAIApiKey: openaiKey,
        modelName: 'gpt-4-turbo-preview',
        temperature: 0.3,
        maxTokens: 4096,
      });
      this.logger.log('RAG Service initialized with OpenAI');
    } else if (anthropicKey) {
      this.model = new ChatAnthropic({
        anthropicApiKey: anthropicKey,
        modelName: 'claude-3-5-sonnet-20241022',
        temperature: 0.3,
        maxTokens: 4096,
      });
      this.logger.log('RAG Service initialized with Anthropic');
    } else {
      this.logger.warn('No AI API keys configured - RAG will be unavailable');
    }
  }

  // ============== Main RAG Query ==============

  async query(
    question: string,
    config: RAGConfig,
    history?: BaseMessage[],
  ): Promise<RAGResponse> {
    if (!this.model) {
      throw new Error('RAG service not initialized - no AI provider available');
    }

    // Step 1: Query expansion (optional)
    const enhancedQuery = config.queryExpansion
      ? await this.expandQuery(question, history)
      : question;

    // Step 2: Retrieve relevant documents
    const searchResults = await this.vectorStore.hybridSearch(
      config.collectionName,
      enhancedQuery,
      (config.topK || 5) * 2, // Get more for reranking
      {
        semanticWeight: 0.7,
        keywordWeight: 0.3,
        filter: config.minScore
          ? (doc) => true // Filter applied after scoring
          : undefined,
      },
    );

    // Step 3: Filter by minimum score
    let filteredResults = searchResults;
    if (config.minScore) {
      filteredResults = searchResults.filter(r => r.score >= config.minScore!);
    }

    // Step 4: Rerank if enabled
    if (config.reranking && filteredResults.length > 0) {
      filteredResults = await this.rerank(question, filteredResults, config.topK || 5);
    } else {
      filteredResults = filteredResults.slice(0, config.topK || 5);
    }

    // Step 5: Build context
    const context = this.buildContext(filteredResults, config.maxContextLength || 4000);

    // Step 6: Generate answer
    const ragContext: RAGContext = {
      sources: filteredResults,
      query: question,
      enhancedQuery: enhancedQuery !== question ? enhancedQuery : undefined,
    };

    const answer = await this.generateAnswer(question, context, history);

    // Step 7: Extract citations
    const citations = this.extractCitations(answer, filteredResults);

    // Step 8: Calculate confidence
    const confidence = this.calculateConfidence(filteredResults, answer);

    return {
      answer,
      context: ragContext,
      citations,
      confidence,
    };
  }

  // ============== Query Expansion ==============

  private async expandQuery(query: string, history?: BaseMessage[]): Promise<string> {
    if (!this.model) return query;

    const expansionPrompt = `Given the query and optional conversation history, generate an expanded search query that captures the user's intent more comprehensively.

Original query: "${query}"

Generate 2-3 alternative phrasings or related terms that would help find relevant information.
Output only the expanded query, not explanations.`;

    const messages: BaseMessage[] = [
      new SystemMessage(expansionPrompt),
    ];

    if (history && history.length > 0) {
      messages.push(...history.slice(-4)); // Last 2 exchanges
    }

    messages.push(new HumanMessage(query));

    try {
      const response = await this.model.invoke(messages);
      const expanded = typeof response.content === 'string'
        ? response.content
        : query;
      
      // Combine original with expanded
      return `${query} ${expanded}`.slice(0, 1000);
    } catch (error) {
      this.logger.warn(`Query expansion failed: ${(error as Error).message}`);
      return query;
    }
  }

  // ============== Reranking ==============

  private async rerank(
    query: string,
    results: SearchResult[],
    topK: number,
  ): Promise<SearchResult[]> {
    if (!this.model || results.length <= topK) {
      return results.slice(0, topK);
    }

    // Create scoring prompt
    const scoringPrompt = `Given the query and document, rate the relevance on a scale of 0-10.
Query: "${query}"

Return only the numeric score.`;

    const scoredResults: { result: SearchResult; rerankedScore: number }[] = [];

    // Score each result (could be parallelized for better performance)
    for (const result of results.slice(0, topK * 2)) {
      try {
        const response = await this.model.invoke([
          new SystemMessage(scoringPrompt),
          new HumanMessage(`Document: "${result.document.content.slice(0, 500)}"`),
        ]);

        const scoreStr = typeof response.content === 'string' ? response.content : '5';
        const score = parseFloat(scoreStr) || 5;

        scoredResults.push({
          result,
          rerankedScore: (score / 10) * 0.4 + result.score * 0.6, // Blend with original
        });
      } catch {
        scoredResults.push({ result, rerankedScore: result.score });
      }
    }

    return scoredResults
      .sort((a, b) => b.rerankedScore - a.rerankedScore)
      .slice(0, topK)
      .map(s => ({ ...s.result, score: s.rerankedScore }));
  }

  // ============== Context Building ==============

  private buildContext(results: SearchResult[], maxLength: number): string {
    const contextParts: string[] = [];
    let currentLength = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const metadata = result.document.metadata;
      
      let source = '';
      if (metadata.filePath) {
        source = `[Source: ${metadata.filePath}]`;
      } else if (metadata.title) {
        source = `[Source: ${metadata.title}]`;
      } else {
        source = `[Source ${i + 1}]`;
      }

      const entry = `${source}\n${result.document.content}\n`;

      if (currentLength + entry.length > maxLength) {
        // Truncate if necessary
        const remaining = maxLength - currentLength;
        if (remaining > 100) {
          contextParts.push(entry.slice(0, remaining));
        }
        break;
      }

      contextParts.push(entry);
      currentLength += entry.length;
    }

    return contextParts.join('\n---\n');
  }

  // ============== Answer Generation ==============

  private async generateAnswer(
    question: string,
    context: string,
    history?: BaseMessage[],
  ): Promise<string> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const messages: BaseMessage[] = [
      new SystemMessage(this.DEFAULT_RAG_SYSTEM_PROMPT),
    ];

    // Add history
    if (history && history.length > 0) {
      messages.push(...history.slice(-6)); // Last 3 exchanges
    }

    // Add context and question
    const userMessage = `Context:
${context}

Question: ${question}

Please answer the question based on the provided context. If the context doesn't contain enough information, acknowledge this.`;

    messages.push(new HumanMessage(userMessage));

    const response = await this.model.invoke(messages);
    return typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);
  }

  // ============== Citation Extraction ==============

  private extractCitations(answer: string, results: SearchResult[]): Citation[] {
    const citations: Citation[] = [];
    const answerLower = answer.toLowerCase();

    for (const result of results) {
      const metadata = result.document.metadata;
      const source = metadata.filePath || metadata.title || 'Unknown';

      // Check if content from this source is likely referenced
      const contentSnippets = result.document.content
        .split(/[.!?]/)
        .filter(s => s.trim().length > 20);

      for (const snippet of contentSnippets) {
        const snippetLower = snippet.toLowerCase().trim();
        const keywords = snippetLower.split(/\s+/).filter(w => w.length > 4);

        // Check keyword overlap
        const matchingKeywords = keywords.filter(k => answerLower.includes(k));
        const relevance = matchingKeywords.length / Math.max(keywords.length, 1);

        if (relevance > 0.3) {
          citations.push({
            content: snippet.trim(),
            source,
            relevance,
          });
        }
      }
    }

    // Deduplicate and sort by relevance
    const uniqueCitations = new Map<string, Citation>();
    for (const citation of citations) {
      const key = citation.content.slice(0, 50);
      if (!uniqueCitations.has(key) || uniqueCitations.get(key)!.relevance < citation.relevance) {
        uniqueCitations.set(key, citation);
      }
    }

    return Array.from(uniqueCitations.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
  }

  // ============== Confidence Calculation ==============

  private calculateConfidence(results: SearchResult[], answer: string): number {
    if (results.length === 0) return 0;

    // Factors:
    // 1. Average relevance score
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

    // 2. Score variance (lower is better)
    const variance = results.reduce((sum, r) => sum + Math.pow(r.score - avgScore, 2), 0) / results.length;
    const varianceFactor = Math.max(0, 1 - variance);

    // 3. Answer length (too short might indicate uncertainty)
    const lengthFactor = Math.min(answer.length / 500, 1);

    // 4. Number of sources used
    const sourceFactor = Math.min(results.length / 3, 1);

    // Combined confidence
    const confidence = (avgScore * 0.4 + varianceFactor * 0.2 + lengthFactor * 0.2 + sourceFactor * 0.2);

    return Math.min(Math.max(confidence, 0), 1);
  }

  // ============== Streaming RAG ==============

  async *streamQuery(
    question: string,
    config: RAGConfig,
    history?: BaseMessage[],
  ): AsyncGenerator<{ type: 'context' | 'answer' | 'done'; data: any }> {
    if (!this.model) {
      throw new Error('RAG service not initialized');
    }

    // Step 1: Retrieve context
    const searchResults = await this.vectorStore.hybridSearch(
      config.collectionName,
      question,
      config.topK || 5,
    );

    yield { type: 'context', data: searchResults.map(r => ({ 
      content: r.document.content.slice(0, 200),
      source: r.document.metadata.filePath || r.document.metadata.title,
      score: r.score,
    }))};

    // Step 2: Build context
    const context = this.buildContext(searchResults, config.maxContextLength || 4000);

    // Step 3: Stream answer
    const messages: BaseMessage[] = [
      new SystemMessage(this.DEFAULT_RAG_SYSTEM_PROMPT),
    ];

    if (history) {
      messages.push(...history.slice(-6));
    }

    messages.push(new HumanMessage(`Context:\n${context}\n\nQuestion: ${question}`));

    const stream = await this.model.stream(messages);
    let fullAnswer = '';

    for await (const chunk of stream) {
      const content = typeof chunk.content === 'string' ? chunk.content : '';
      if (content) {
        fullAnswer += content;
        yield { type: 'answer', data: content };
      }
    }

    yield { type: 'done', data: {
      fullAnswer,
      sources: searchResults.length,
      confidence: this.calculateConfidence(searchResults, fullAnswer),
    }};
  }

  // ============== Code-Specific RAG ==============

  async queryCodebase(
    question: string,
    projectId: string,
    options?: {
      language?: string;
      filePath?: string;
      includeTests?: boolean;
    },
  ): Promise<RAGResponse> {
    const collectionName = `project:${projectId}:code`;

    // Ensure collection exists
    const stats = this.vectorStore.getCollectionStats(collectionName);
    if (!stats) {
      throw new Error(`No codebase index found for project ${projectId}`);
    }

    // Build filter
    const filter = (doc: any) => {
      if (options?.language && doc.metadata.language !== options.language) {
        return false;
      }
      if (options?.filePath && !doc.metadata.filePath?.includes(options.filePath)) {
        return false;
      }
      if (!options?.includeTests && doc.metadata.filePath?.includes('test')) {
        return false;
      }
      return true;
    };

    return this.query(question, {
      collectionName,
      topK: 10,
      minScore: 0.5,
      reranking: true,
      maxContextLength: 6000,
      includeMetadata: true,
    });
  }
}
