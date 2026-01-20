import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';
import { LoggerService } from '../../common/services/logger.service';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface BatchEmbeddingResult {
  embeddings: EmbeddingResult[];
  model: string;
  dimensions: number;
  totalTokens: number;
}

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private openaiEmbeddings: OpenAIEmbeddings | null = null;
  private embeddingDimensions = 1536; // text-embedding-3-small default
  private maxBatchSize = 100;
  private maxTokensPerBatch = 8000;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext('EmbeddingsService');
  }

  async onModuleInit() {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    
    if (openaiKey) {
      this.openaiEmbeddings = new OpenAIEmbeddings({
        openAIApiKey: openaiKey,
        modelName: 'text-embedding-3-small',
        dimensions: this.embeddingDimensions,
      });
      this.logger.log('OpenAI Embeddings initialized');
    } else {
      this.logger.warn('OPENAI_API_KEY not configured - embeddings will be unavailable');
    }
  }

  // ============== Single Embedding ==============

  async embedText(text: string, metadata?: Record<string, any>): Promise<EmbeddingResult> {
    if (!this.openaiEmbeddings) {
      throw new Error('Embeddings service not initialized');
    }

    const embedding = await this.openaiEmbeddings.embedQuery(text);
    
    return {
      text,
      embedding,
      metadata,
    };
  }

  // ============== Batch Embeddings ==============

  async embedTexts(
    texts: string[],
    metadataList?: Record<string, any>[],
  ): Promise<BatchEmbeddingResult> {
    if (!this.openaiEmbeddings) {
      throw new Error('Embeddings service not initialized');
    }

    const results: EmbeddingResult[] = [];
    let totalTokens = 0;

    // Process in batches
    for (let i = 0; i < texts.length; i += this.maxBatchSize) {
      const batch = texts.slice(i, i + this.maxBatchSize);
      const batchMetadata = metadataList?.slice(i, i + this.maxBatchSize);

      const embeddings = await this.openaiEmbeddings.embedDocuments(batch);

      for (let j = 0; j < batch.length; j++) {
        results.push({
          text: batch[j],
          embedding: embeddings[j],
          metadata: batchMetadata?.[j],
        });
      }

      // Estimate tokens (rough approximation)
      totalTokens += batch.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);
    }

    return {
      embeddings: results,
      model: 'text-embedding-3-small',
      dimensions: this.embeddingDimensions,
      totalTokens,
    };
  }

  // ============== Code-Specific Embeddings ==============

  async embedCode(
    code: string,
    language: string,
    filePath?: string,
  ): Promise<EmbeddingResult> {
    // Preprocess code for better embeddings
    const preprocessed = this.preprocessCode(code, language);
    
    return this.embedText(preprocessed, {
      type: 'code',
      language,
      filePath,
      originalLength: code.length,
    });
  }

  async embedCodeChunks(
    code: string,
    language: string,
    filePath?: string,
    chunkSize = 1000,
    overlap = 200,
  ): Promise<EmbeddingResult[]> {
    const chunks = this.chunkCode(code, language, chunkSize, overlap);
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const result = await this.embedText(chunk.text, {
        type: 'code_chunk',
        language,
        filePath,
        chunkIndex: i,
        totalChunks: chunks.length,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
      });
      results.push(result);
    }

    return results;
  }

  // ============== Document Embeddings ==============

  async embedDocument(
    content: string,
    title?: string,
    filePath?: string,
  ): Promise<EmbeddingResult[]> {
    const chunks = this.chunkDocument(content);
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const result = await this.embedText(chunks[i], {
        type: 'document',
        title,
        filePath,
        chunkIndex: i,
        totalChunks: chunks.length,
      });
      results.push(result);
    }

    return results;
  }

  // ============== Similarity Computation ==============

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }

    return Math.sqrt(sum);
  }

  // ============== Preprocessing ==============

  private preprocessCode(code: string, language: string): string {
    // Remove excessive whitespace while preserving structure
    let processed = code.replace(/\s+/g, ' ').trim();

    // Add language context
    processed = `[${language}] ${processed}`;

    // Truncate if too long
    if (processed.length > 8000) {
      processed = processed.substring(0, 8000);
    }

    return processed;
  }

  private chunkCode(
    code: string,
    language: string,
    chunkSize: number,
    overlap: number,
  ): { text: string; startLine: number; endLine: number }[] {
    const lines = code.split('\n');
    const chunks: { text: string; startLine: number; endLine: number }[] = [];
    
    let currentChunk: string[] = [];
    let currentLength = 0;
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLength = line.length + 1; // +1 for newline

      if (currentLength + lineLength > chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          text: `[${language}]\n${currentChunk.join('\n')}`,
          startLine,
          endLine: i - 1,
        });

        // Calculate overlap
        const overlapLines = Math.ceil(overlap / (currentLength / currentChunk.length));
        const overlapStart = Math.max(0, currentChunk.length - overlapLines);
        
        currentChunk = currentChunk.slice(overlapStart);
        currentLength = currentChunk.reduce((sum, l) => sum + l.length + 1, 0);
        startLine = i - currentChunk.length;
      }

      currentChunk.push(line);
      currentLength += lineLength;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        text: `[${language}]\n${currentChunk.join('\n')}`,
        startLine,
        endLine: lines.length - 1,
      });
    }

    return chunks;
  }

  private chunkDocument(content: string, chunkSize = 1500, overlap = 200): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/(?<=[.!?])\s+/);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Keep overlap
        const words = currentChunk.split(' ');
        const overlapWords = Math.ceil(overlap / 5); // Approximate words for overlap
        currentChunk = words.slice(-overlapWords).join(' ') + ' ';
      }
      
      currentChunk += sentence + ' ';
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // ============== Utilities ==============

  getDimensions(): number {
    return this.embeddingDimensions;
  }

  isInitialized(): boolean {
    return this.openaiEmbeddings !== null;
  }
}
