import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/services/logger.service';
import { EmbeddingsService, EmbeddingResult } from './embeddings.service';

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  distance: number;
}

export interface VectorCollection {
  name: string;
  documents: Map<string, VectorDocument>;
  dimensions: number;
  createdAt: Date;
}

interface HNSWNode {
  id: string;
  embedding: number[];
  neighbors: Map<number, string[]>; // level -> neighbor ids
  level: number;
}

@Injectable()
export class VectorStoreService implements OnModuleInit, OnModuleDestroy {
  private collections: Map<string, VectorCollection> = new Map();
  private hnswIndices: Map<string, Map<string, HNSWNode>> = new Map();
  
  // HNSW parameters
  private readonly M = 16; // Max connections per layer
  private readonly efConstruction = 200; // Construction quality
  private readonly efSearch = 50; // Search quality
  private readonly mL = 1 / Math.log(this.M); // Level multiplier

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly embeddingsService: EmbeddingsService,
  ) {
    this.logger.setContext('VectorStoreService');
  }

  async onModuleInit() {
    this.logger.log('VectorStoreService initialized with in-memory HNSW index');
  }

  async onModuleDestroy() {
    this.collections.clear();
    this.hnswIndices.clear();
  }

  // ============== Collection Management ==============

  createCollection(name: string, dimensions?: number): VectorCollection {
    if (this.collections.has(name)) {
      return this.collections.get(name)!;
    }

    const collection: VectorCollection = {
      name,
      documents: new Map(),
      dimensions: dimensions || this.embeddingsService.getDimensions(),
      createdAt: new Date(),
    };

    this.collections.set(name, collection);
    this.hnswIndices.set(name, new Map());
    
    this.logger.log(`Created collection: ${name}`);
    return collection;
  }

  deleteCollection(name: string): boolean {
    const deleted = this.collections.delete(name);
    this.hnswIndices.delete(name);
    
    if (deleted) {
      this.logger.log(`Deleted collection: ${name}`);
    }
    return deleted;
  }

  listCollections(): string[] {
    return Array.from(this.collections.keys());
  }

  getCollectionStats(name: string): { count: number; dimensions: number } | null {
    const collection = this.collections.get(name);
    if (!collection) return null;

    return {
      count: collection.documents.size,
      dimensions: collection.dimensions,
    };
  }

  // ============== Document Operations ==============

  async addDocument(
    collectionName: string,
    id: string,
    content: string,
    metadata: Record<string, any> = {},
    embedding?: number[],
  ): Promise<VectorDocument> {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    // Generate embedding if not provided
    const finalEmbedding = embedding || 
      (await this.embeddingsService.embedText(content)).embedding;

    if (finalEmbedding.length !== collection.dimensions) {
      throw new Error(`Embedding dimensions mismatch: expected ${collection.dimensions}, got ${finalEmbedding.length}`);
    }

    const document: VectorDocument = {
      id,
      content,
      embedding: finalEmbedding,
      metadata,
      createdAt: new Date(),
    };

    collection.documents.set(id, document);
    
    // Add to HNSW index
    await this.addToHNSW(collectionName, document);

    return document;
  }

  async addDocuments(
    collectionName: string,
    documents: { id: string; content: string; metadata?: Record<string, any> }[],
  ): Promise<VectorDocument[]> {
    const results: VectorDocument[] = [];

    // Batch embed all documents
    const texts = documents.map(d => d.content);
    const metadataList = documents.map(d => d.metadata || {});
    const embeddingResults = await this.embeddingsService.embedTexts(texts, metadataList);

    for (let i = 0; i < documents.length; i++) {
      const doc = await this.addDocument(
        collectionName,
        documents[i].id,
        documents[i].content,
        documents[i].metadata || {},
        embeddingResults.embeddings[i].embedding,
      );
      results.push(doc);
    }

    return results;
  }

  getDocument(collectionName: string, id: string): VectorDocument | null {
    const collection = this.collections.get(collectionName);
    if (!collection) return null;
    return collection.documents.get(id) || null;
  }

  deleteDocument(collectionName: string, id: string): boolean {
    const collection = this.collections.get(collectionName);
    if (!collection) return false;

    const deleted = collection.documents.delete(id);
    
    // Remove from HNSW index
    const index = this.hnswIndices.get(collectionName);
    if (index) {
      index.delete(id);
    }

    return deleted;
  }

  // ============== Vector Search ==============

  async search(
    collectionName: string,
    query: string,
    k = 10,
    filter?: (doc: VectorDocument) => boolean,
  ): Promise<SearchResult[]> {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    // Embed query
    const queryEmbedding = (await this.embeddingsService.embedText(query)).embedding;

    return this.searchByVector(collectionName, queryEmbedding, k, filter);
  }

  async searchByVector(
    collectionName: string,
    queryEmbedding: number[],
    k = 10,
    filter?: (doc: VectorDocument) => boolean,
  ): Promise<SearchResult[]> {
    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    // Use HNSW search for larger collections
    if (collection.documents.size > 1000) {
      return this.hnswSearch(collectionName, queryEmbedding, k, filter);
    }

    // Brute force for smaller collections
    return this.bruteForceSearch(collection, queryEmbedding, k, filter);
  }

  private bruteForceSearch(
    collection: VectorCollection,
    queryEmbedding: number[],
    k: number,
    filter?: (doc: VectorDocument) => boolean,
  ): SearchResult[] {
    const results: SearchResult[] = [];

    for (const doc of collection.documents.values()) {
      if (filter && !filter(doc)) continue;

      const score = this.embeddingsService.cosineSimilarity(queryEmbedding, doc.embedding);
      const distance = this.embeddingsService.euclideanDistance(queryEmbedding, doc.embedding);

      results.push({ document: doc, score, distance });
    }

    // Sort by score (highest first) and return top k
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  // ============== HNSW Index Implementation ==============

  private getRandomLevel(): number {
    let level = 0;
    while (Math.random() < this.mL && level < 16) {
      level++;
    }
    return level;
  }

  private async addToHNSW(collectionName: string, document: VectorDocument): Promise<void> {
    const index = this.hnswIndices.get(collectionName);
    if (!index) return;

    const level = this.getRandomLevel();
    const node: HNSWNode = {
      id: document.id,
      embedding: document.embedding,
      neighbors: new Map(),
      level,
    };

    // Initialize neighbor lists for each level
    for (let l = 0; l <= level; l++) {
      node.neighbors.set(l, []);
    }

    if (index.size === 0) {
      // First node
      index.set(document.id, node);
      return;
    }

    // Find entry point (node with highest level)
    let entryPoint = this.findEntryPoint(index);
    
    // Search for neighbors at each level
    for (let l = entryPoint.level; l >= 0; l--) {
      const neighbors = this.searchLayer(index, document.embedding, entryPoint.id, l, this.efConstruction);
      
      if (l <= level) {
        // Connect to neighbors
        const selectedNeighbors = neighbors.slice(0, this.M);
        node.neighbors.set(l, selectedNeighbors.map(n => n.id));

        // Add reverse connections
        for (const neighbor of selectedNeighbors) {
          const neighborNode = index.get(neighbor.id);
          if (neighborNode) {
            const neighborList = neighborNode.neighbors.get(l) || [];
            neighborList.push(document.id);
            
            // Prune if necessary
            if (neighborList.length > this.M * 2) {
              const pruned = this.selectNeighbors(index, neighborNode.embedding, neighborList, this.M);
              neighborNode.neighbors.set(l, pruned);
            } else {
              neighborNode.neighbors.set(l, neighborList);
            }
          }
        }
      }

      if (neighbors.length > 0) {
        entryPoint = index.get(neighbors[0].id) || entryPoint;
      }
    }

    index.set(document.id, node);
  }

  private findEntryPoint(index: Map<string, HNSWNode>): HNSWNode {
    let maxLevel = -1;
    let entryPoint: HNSWNode | null = null;

    for (const node of index.values()) {
      if (node.level > maxLevel) {
        maxLevel = node.level;
        entryPoint = node;
      }
    }

    return entryPoint!;
  }

  private searchLayer(
    index: Map<string, HNSWNode>,
    query: number[],
    entryId: string,
    level: number,
    ef: number,
  ): { id: string; distance: number }[] {
    const visited = new Set<string>([entryId]);
    const candidates: { id: string; distance: number }[] = [];
    const results: { id: string; distance: number }[] = [];

    const entryNode = index.get(entryId);
    if (!entryNode) return [];

    const entryDist = this.embeddingsService.euclideanDistance(query, entryNode.embedding);
    candidates.push({ id: entryId, distance: entryDist });
    results.push({ id: entryId, distance: entryDist });

    while (candidates.length > 0) {
      // Get closest candidate
      candidates.sort((a, b) => a.distance - b.distance);
      const current = candidates.shift()!;

      // Check if we can stop
      if (results.length >= ef && current.distance > results[results.length - 1].distance) {
        break;
      }

      const currentNode = index.get(current.id);
      if (!currentNode) continue;

      const neighbors = currentNode.neighbors.get(level) || [];
      
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);

        const neighborNode = index.get(neighborId);
        if (!neighborNode) continue;

        const dist = this.embeddingsService.euclideanDistance(query, neighborNode.embedding);

        if (results.length < ef || dist < results[results.length - 1].distance) {
          candidates.push({ id: neighborId, distance: dist });
          results.push({ id: neighborId, distance: dist });
          results.sort((a, b) => a.distance - b.distance);
          
          if (results.length > ef) {
            results.pop();
          }
        }
      }
    }

    return results;
  }

  private selectNeighbors(
    index: Map<string, HNSWNode>,
    query: number[],
    candidates: string[],
    M: number,
  ): string[] {
    const scored = candidates.map(id => {
      const node = index.get(id);
      if (!node) return { id, distance: Infinity };
      return {
        id,
        distance: this.embeddingsService.euclideanDistance(query, node.embedding),
      };
    });

    scored.sort((a, b) => a.distance - b.distance);
    return scored.slice(0, M).map(s => s.id);
  }

  private hnswSearch(
    collectionName: string,
    queryEmbedding: number[],
    k: number,
    filter?: (doc: VectorDocument) => boolean,
  ): SearchResult[] {
    const index = this.hnswIndices.get(collectionName);
    const collection = this.collections.get(collectionName);
    
    if (!index || !collection || index.size === 0) {
      return [];
    }

    const entryPoint = this.findEntryPoint(index);
    let currentId = entryPoint.id;

    // Traverse from top level to level 1
    for (let level = entryPoint.level; level > 0; level--) {
      const results = this.searchLayer(index, queryEmbedding, currentId, level, 1);
      if (results.length > 0) {
        currentId = results[0].id;
      }
    }

    // Search at level 0
    const searchResults = this.searchLayer(index, queryEmbedding, currentId, 0, Math.max(this.efSearch, k * 2));

    // Convert to SearchResult format
    const results: SearchResult[] = [];
    
    for (const result of searchResults) {
      const document = collection.documents.get(result.id);
      if (!document) continue;
      if (filter && !filter(document)) continue;

      const score = this.embeddingsService.cosineSimilarity(queryEmbedding, document.embedding);
      results.push({
        document,
        score,
        distance: result.distance,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  // ============== Hybrid Search ==============

  async hybridSearch(
    collectionName: string,
    query: string,
    k = 10,
    options?: {
      semanticWeight?: number;
      keywordWeight?: number;
      filter?: (doc: VectorDocument) => boolean;
    },
  ): Promise<SearchResult[]> {
    const semanticWeight = options?.semanticWeight ?? 0.7;
    const keywordWeight = options?.keywordWeight ?? 0.3;

    const collection = this.collections.get(collectionName);
    if (!collection) {
      throw new Error(`Collection ${collectionName} not found`);
    }

    // Semantic search
    const semanticResults = await this.search(collectionName, query, k * 2, options?.filter);

    // Keyword search (BM25-like)
    const keywordResults = this.keywordSearch(collection, query, k * 2, options?.filter);

    // Combine results
    const combined = new Map<string, { score: number; document: VectorDocument }>();

    for (const result of semanticResults) {
      combined.set(result.document.id, {
        score: result.score * semanticWeight,
        document: result.document,
      });
    }

    for (const result of keywordResults) {
      const existing = combined.get(result.document.id);
      if (existing) {
        existing.score += result.score * keywordWeight;
      } else {
        combined.set(result.document.id, {
          score: result.score * keywordWeight,
          document: result.document,
        });
      }
    }

    // Sort and return top k
    return Array.from(combined.values())
      .map(item => ({
        document: item.document,
        score: item.score,
        distance: 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  private keywordSearch(
    collection: VectorCollection,
    query: string,
    k: number,
    filter?: (doc: VectorDocument) => boolean,
  ): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const results: SearchResult[] = [];

    for (const doc of collection.documents.values()) {
      if (filter && !filter(doc)) continue;

      const content = doc.content.toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        const matches = (content.match(new RegExp(term, 'g')) || []).length;
        if (matches > 0) {
          // TF-IDF inspired scoring
          const tf = matches / content.length;
          score += tf * Math.log(collection.documents.size / (matches + 1));
        }
      }

      if (score > 0) {
        results.push({
          document: doc,
          score,
          distance: 0,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, k);
  }
}
