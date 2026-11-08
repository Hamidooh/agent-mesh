/**
 * AgentMesh - In-Memory Vector Store & Semantic Similarity Engine
 * Zero-dependency TF-IDF + Cosine similarity vector search for episodic memory.
 */

import { randomUUID } from 'node:crypto';
import { MemoryEntry, MemorySearchResult } from '../types.js';

export class VectorStore {
  private entries: Map<string, MemoryEntry> = new Map();
  private vocabulary: Map<string, number> = new Map(); // term -> index
  private documentFrequency: Map<string, number> = new Map(); // term -> count of docs
  private totalDocuments: number = 0;

  private readonly stopwords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
    'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both',
    'but', 'by', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers',
    'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
    'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only',
    'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she',
    'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves',
    'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until',
    'up', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
    'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
  ]);

  /**
   * Tokenize, lowercase, strip punctuation, remove stopwords.
   */
  public tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !this.stopwords.has(w));
  }

  /**
   * Insert a text memory and index its vector.
   */
  public add(
    agentId: string,
    text: string,
    metadata?: Record<string, any>
  ): MemoryEntry {
    const tokens = this.tokenize(text);
    const uniqueTokens = new Set(tokens);

    this.totalDocuments++;

    // Update vocabulary & document frequencies
    for (const token of uniqueTokens) {
      if (!this.vocabulary.has(token)) {
        this.vocabulary.set(token, this.vocabulary.size);
      }
      const count = this.documentFrequency.get(token) || 0;
      this.documentFrequency.set(token, count + 1);
    }

    const vector = this.computeTfIdfVector(tokens);

    const entry: MemoryEntry = {
      id: randomUUID(),
      agentId,
      text,
      vector,
      metadata,
      timestamp: Date.now(),
    };

    this.entries.set(entry.id, entry);
    return entry;
  }

  /**
   * Compute normalized TF-IDF vector for given tokens.
   */
  private computeTfIdfVector(tokens: string[]): number[] {
    const termCounts: Map<string, number> = new Map();
    for (const t of tokens) {
      termCounts.set(t, (termCounts.get(t) || 0) + 1);
    }

    const vocabSize = Math.max(this.vocabulary.size, 1);
    const vector = new Array(vocabSize).fill(0);

    let normSq = 0;
    for (const [term, count] of termCounts.entries()) {
      const idx = this.vocabulary.get(term);
      if (idx !== undefined && idx < vocabSize) {
        // TF: term count / total tokens in doc
        const tf = count / tokens.length;
        // IDF: log((N + 1) / (df + 1)) + 1
        const df = this.documentFrequency.get(term) || 0;
        const idf = Math.log((this.totalDocuments + 1) / (df + 1)) + 1;
        const tfIdf = tf * idf;
        vector[idx] = tfIdf;
        normSq += tfIdf * tfIdf;
      }
    }

    // L2 Normalize
    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] = (vector[i] ?? 0) / norm;
      }
    }

    return vector;
  }

  /**
   * Compute Cosine Similarity between two vectors: (A . B) / (||A|| * ||B||)
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      const vA = a[i] ?? 0;
      const vB = b[i] ?? 0;
      dot += vA * vB;
      normA += vA * vA;
      normB += vB * vB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Query the memory store for top-K semantically relevant entries.
   */
  public search(
    queryText: string,
    topK: number = 3,
    threshold: number = 0.05,
    agentIdFilter?: string
  ): MemorySearchResult[] {
    const queryTokens = this.tokenize(queryText);
    if (queryTokens.length === 0) return [];

    const queryVector = this.computeTfIdfVector(queryTokens);
    const results: MemorySearchResult[] = [];

    for (const entry of this.entries.values()) {
      if (agentIdFilter && entry.agentId !== agentIdFilter) continue;

      const similarity = this.cosineSimilarity(queryVector, entry.vector);
      if (similarity >= threshold) {
        results.push({ entry, similarity });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  public getAllEntries(): MemoryEntry[] {
    return Array.from(this.entries.values());
  }

  public count(): number {
    return this.entries.size;
  }

  public clear(): void {
    this.entries.clear();
    this.vocabulary.clear();
    this.documentFrequency.clear();
    this.totalDocuments = 0;
  }
}
