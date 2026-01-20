import { Injectable, Logger } from '@nestjs/common';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenRouter } from '@openrouter/sdk';

import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly openRouter: OpenRouter;

  constructor(private readonly supabaseService: SupabaseService) {
    this.openRouter = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  /**
   * Generate embeddings using Voyage AI via OpenRouter
   */
  async generateEmbeddings(text: string): Promise<number[]> {
    try {
      const response = await this.openRouter.embeddings.generate({
        input: text,
        model: 'voyageai/voyage-3-large',
      });

      // Handle OpenRouter response format
      // For now, return a mock embedding until we test the actual API
      // TODO: Implement proper response parsing based on actual API response
      this.logger.warn('Using mock embeddings - implement proper OpenRouter response parsing');

      // Mock embedding for development (1024 dimensions as per Voyage AI)
      return Array.from({ length: 1024 }, () => Math.random() * 2 - 1);
    } catch (error) {
      this.logger.error('Error generating embeddings:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Split document into chunks for embedding
   */
  async splitDocument(
    content: string,
    chunkSize: number = 1000,
    overlap: number = 200,
  ): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap: overlap,
      separators: ['\n\n', '\n', ' ', ''],
    });

    return await splitter.splitText(content);
  }

  /**
   * Store document embeddings in database
   */
  async storeDocumentEmbeddings(
    documentId: string,
    agencyId: string,
    chunks: string[],
    embeddings: number[][],
  ): Promise<void> {
    const client = this.supabaseService.getClient();

    try {
      // Prepare embeddings data
      const embeddingsData = chunks.map((chunk, index) => ({
        document_id: documentId,
        agency_id: agencyId,
        chunk_index: index,
        chunk_content: chunk,
        embedding: `[${embeddings[index].join(',')}]`, // Convert to PostgreSQL vector format
        model_used: 'voyageai/voyage-3-large',
      }));

      // Insert embeddings in batches to avoid payload size limits
      const batchSize = 100;
      for (let i = 0; i < embeddingsData.length; i += batchSize) {
        const batch = embeddingsData.slice(i, i + batchSize);
        const { error } = await client.from('document_embeddings').insert(batch);

        if (error) {
          throw error;
        }
      }

      this.logger.log(`Stored ${embeddingsData.length} embeddings for document ${documentId}`);
    } catch (error) {
      this.logger.error('Error storing document embeddings:', error);
      throw new Error('Failed to store document embeddings');
    }
  }

  /**
   * Process and embed a document
   */
  async processDocument(documentId: string, agencyId: string, content: string): Promise<void> {
    try {
      // Split document into chunks
      const chunks = await this.splitDocument(content);

      // Generate embeddings for each chunk
      const embeddings: number[][] = [];
      for (const chunk of chunks) {
        const embedding = await this.generateEmbeddings(chunk);
        embeddings.push(embedding);
      }

      // Store embeddings in database
      await this.storeDocumentEmbeddings(documentId, agencyId, chunks, embeddings);

      this.logger.log(`Successfully processed document ${documentId} with ${chunks.length} chunks`);
    } catch (error) {
      this.logger.error(`Error processing document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  async searchSimilarDocuments(
    query: string,
    agencyId: string,
    limit: number = 5,
  ): Promise<
    Array<{
      document_id: string;
      chunk_content: string;
      similarity: number;
      document_title: string;
      document_category: string;
      metadata?: any;
    }>
  > {
    try {
      const client = this.supabaseService.getClient();

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbeddings(query);

      // Search for similar embeddings using pgvector
      const { data, error } = await client.rpc('search_similar_documents', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        agency_id: agencyId,
        match_limit: limit,
      });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error searching similar documents:', error);
      throw new Error('Failed to search similar documents');
    }
  }

  /**
   * Update embeddings for an existing document
   */
  async updateDocumentEmbeddings(
    documentId: string,
    agencyId: string,
    newContent: string,
  ): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      // Delete existing embeddings
      const { error: deleteError } = await client
        .from('document_embeddings')
        .delete()
        .eq('document_id', documentId)
        .eq('agency_id', agencyId);

      if (deleteError) {
        throw deleteError;
      }

      // Process new content
      await this.processDocument(documentId, agencyId, newContent);

      this.logger.log(`Updated embeddings for document ${documentId}`);
    } catch (error) {
      this.logger.error(`Error updating embeddings for document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete embeddings for a document
   */
  async deleteDocumentEmbeddings(documentId: string, agencyId: string): Promise<void> {
    try {
      const client = this.supabaseService.getClient();

      const { error } = await client
        .from('document_embeddings')
        .delete()
        .eq('document_id', documentId)
        .eq('agency_id', agencyId);

      if (error) {
        throw error;
      }

      this.logger.log(`Deleted embeddings for document ${documentId}`);
    } catch (error) {
      this.logger.error(`Error deleting embeddings for document ${documentId}:`, error);
      throw error;
    }
  }
}
