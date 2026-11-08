# ADR 003: In-Memory TF-IDF Vector Store and Cosine Similarity

## Status
Accepted

## Context
Autonomous agents require episodic memory to recall previous findings and domain standards. External vector databases (Chroma, Pinecone) introduce heavy external dependencies, network latency, and deployment complexity for lightweight local runtimes.

## Decision
We implemented a zero-dependency in-memory vector store directly in TypeScript using TF-IDF projection and Cosine similarity:
- Tokenizer with stopword filtering.
- Dynamic vocabulary indexing with document frequency calculation.
- L2-normalized TF-IDF vector representations.
- Sub-millisecond cosine similarity ranking ($\mathcal{O}(N)$ where $N$ is episodic memory size).

## Consequences
- Zero external infrastructure requirements.
- Air-gapped, local execution without network calls or third-party API dependencies.
