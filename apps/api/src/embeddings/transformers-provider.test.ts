import { describe, expect, it } from 'vitest';
import { TransformersEmbeddingProvider } from './transformers-provider.js';

describe('TransformersEmbeddingProvider', () => {
  it('produces 384-dim normalized vectors (confirms Node/ONNX works)', async () => {
    const p = new TransformersEmbeddingProvider();
    const [v] = await p.embed(['worker fell from a roof']);
    expect(v).toHaveLength(384);
    const norm = Math.sqrt(v!.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 1);
  });
});
