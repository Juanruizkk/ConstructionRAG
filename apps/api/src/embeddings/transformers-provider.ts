import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { env } from '../config.js';
import type { EmbeddingProvider } from './provider.js';

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  readonly model = env.EMBEDDING_MODEL;
  readonly dimensions = 384;
  private extractor: FeatureExtractionPipeline | null = null;

  private async get(): Promise<FeatureExtractionPipeline> {
    this.extractor ??= await pipeline('feature-extraction', this.model);
    return this.extractor;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const ex = await this.get();
    const out = await ex(texts, { pooling: 'mean', normalize: true });
    return out.tolist() as number[][];
  }
}
