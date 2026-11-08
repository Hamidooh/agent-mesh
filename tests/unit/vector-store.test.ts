import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VectorStore } from '../../src/memory/vector-store.js';

describe('VectorStore & Cosine Similarity', () => {
  it('should tokenize text and remove punctuation and stopwords', () => {
    const store = new VectorStore();
    const tokens = store.tokenize('The quick brown fox jumps over the lazy dog!');
    assert.ok(tokens.includes('quick'));
    assert.ok(tokens.includes('brown'));
    assert.ok(tokens.includes('lazy'));
    assert.strictEqual(tokens.includes('the'), false); // Stopword removed
  });

  it('should compute high cosine similarity for identical or related vectors', () => {
    const store = new VectorStore();
    const vecA = [1, 0, 1];
    const vecB = [1, 0, 1];
    const sim = store.cosineSimilarity(vecA, vecB);
    assert.strictEqual(Math.round(sim), 1);
  });

  it('should rank semantically related memories higher in search', () => {
    const store = new VectorStore();
    store.add('agent-1', 'Vulnerability detected in SQL query concatenation.');
    store.add('agent-2', 'Performance optimization with in-memory caching.');
    store.add('agent-3', 'Database connection pool timeout configuration.');

    const results = store.search('SQL injection vulnerability', 2);
    assert.strictEqual(results.length > 0, true);
    assert.strictEqual(results[0]?.entry.agentId, 'agent-1');
    assert.ok(results[0]?.similarity! > 0.2);
  });
});
