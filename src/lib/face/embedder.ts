import FaceModelManager from './modelLoader';

// Use same ONNX Runtime loading mechanism as modelLoader
async function loadOnnxRuntime() {
  try {
    // First try ES module import
    const ort = await import('onnxruntime-web');
    if (ort.Tensor) {
      console.log('✅ ONNX Runtime loaded for embedder via ES module');
      return ort;
    }
    throw new Error('Tensor not found in ES module');
  } catch (error) {
    console.log('ES module failed, trying global fallback...');
    // Try global fallback
    if (typeof window !== 'undefined' && (window as any).ort) {
      const globalOrt = (window as any).ort;
      if (globalOrt.Tensor) {
        console.log('✅ ONNX Runtime loaded for embedder via global');
        return globalOrt;
      }
    }
    throw new Error(`ONNX Runtime Tensor not available: ${error}`);
  }
}

export interface FaceEmbedding {
  embedding: number[];
  quality: number;
  timestamp: number;
}

export interface FaceDetectionResult {
  success: boolean;
  embedding?: number[];
  quality?: number;
  error?: string;
}

class FaceEmbedder {
  private static instance: FaceEmbedder;

  private constructor() {}

  static getInstance(): FaceEmbedder {
    if (!FaceEmbedder.instance) {
      FaceEmbedder.instance = new FaceEmbedder();
    }
    return FaceEmbedder.instance;
  }

  /**
   * Extract face embedding from canvas element
   */
  async extractEmbedding(canvas: HTMLCanvasElement): Promise<FaceDetectionResult> {
    try {
      const session = await FaceModelManager.getInstance().loadModel();
      const config = FaceModelManager.getInstance().getConfig();
      
      if (!config) {
        throw new Error('Model configuration not loaded');
      }

      // Preprocess image
      const preprocessedData = this.preprocessImage(canvas, config);
      const ort = await loadOnnxRuntime();
      const inputTensor = new ort.Tensor('float32', preprocessedData, [1, 3, 112, 112]);

      // Debug: Log input/output names
      console.log('Model input names:', session.inputNames);
      console.log('Model output names:', session.outputNames);
      
      // Use the correct input name from the model
      const inputName = session.inputNames[0]; // Use first input name from model
      const outputName = session.outputNames[0]; // Use first output name from model
      
      const feeds = { [inputName]: inputTensor };
      console.log('Using input name:', inputName, 'with tensor shape:', inputTensor.dims);

      // Run inference
      const results = await session.run(feeds);
      const outputTensor = results[outputName];
      
      if (!outputTensor || !outputTensor.data) {
        throw new Error('Invalid model output');
      }

      // Extract embedding and normalize
      const rawEmbedding = Array.from(outputTensor.data as Float32Array);
      const normalizedEmbedding = this.normalizeEmbedding(rawEmbedding);
      
      // Calculate quality score based on embedding magnitude
      const quality = this.calculateQualityScore(normalizedEmbedding);

      // 🔍 DETAILED DEBUG LOGGING
      console.log('🎯 FACE EMBEDDING EXTRACTION DEBUG:');
      console.log(`   Raw embedding length: ${rawEmbedding.length}`);
      console.log(`   Raw embedding first 10: [${rawEmbedding.slice(0, 10).map(x => x.toFixed(4)).join(', ')}]`);
      console.log(`   Raw embedding sum: ${rawEmbedding.reduce((a, b) => a + b, 0).toFixed(4)}`);
      console.log(`   Raw embedding magnitude: ${Math.sqrt(rawEmbedding.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}`);
      console.log(`   Normalized embedding first 10: [${normalizedEmbedding.slice(0, 10).map(x => x.toFixed(4)).join(', ')}]`);
      console.log(`   Normalized embedding sum: ${normalizedEmbedding.reduce((a, b) => a + b, 0).toFixed(4)}`);
      console.log(`   Quality score: ${quality.toFixed(4)}`);
      console.log(`   Quality calculation - magnitude: ${Math.sqrt(normalizedEmbedding.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}`);
      console.log(`   Quality calculation - variance: ${this.calculateVariance(normalizedEmbedding).toFixed(6)}`);

      return {
        success: true,
        embedding: normalizedEmbedding,
        quality
      };

    } catch (error) {
      console.error('Face embedding extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Preprocess image to model input format (112x112, normalized)
   */
  private preprocessImage(canvas: HTMLCanvasElement, config: any): Float32Array {
    const { width, height } = config.inputSize;
    const { mean, std } = config.normalization;

    // Create processing canvas
    const processCanvas = document.createElement('canvas');
    processCanvas.width = width;
    processCanvas.height = height;
    const ctx = processCanvas.getContext('2d')!;

    // Resize image maintaining aspect ratio
    ctx.drawImage(canvas, 0, 0, width, height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    // Convert to CHW format and normalize
    const inputData = new Float32Array(3 * width * height);
    
    for (let i = 0; i < width * height; i++) {
      // RGB channels
      const r = data[i * 4] / 255.0;
      const g = data[i * 4 + 1] / 255.0;
      const b = data[i * 4 + 2] / 255.0;

      // Normalize and arrange in CHW format
      inputData[i] = (r - mean[0]) / std[0]; // R channel
      inputData[width * height + i] = (g - mean[1]) / std[1]; // G channel
      inputData[2 * width * height + i] = (b - mean[2]) / std[2]; // B channel
    }

    return inputData;
  }

  /**
   * L2 normalize embedding vector
   */
  private normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) {
      console.warn('Zero magnitude embedding detected');
      return embedding;
    }

    return embedding.map(val => val / magnitude);
  }

  /**
   * Calculate quality score based on embedding characteristics
   */
  private calculateQualityScore(embedding: number[]): number {
    // Enhanced quality metrics for better differentiation
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const variance = this.calculateVariance(embedding);
    const sparsity = embedding.filter(val => Math.abs(val) < 0.01).length / embedding.length;
    const maxValue = Math.max(...embedding.map(Math.abs));
    
    // Quality components
    const magnitudeScore = Math.min(magnitude / 1.0, 1.0); // Should be close to 1 for normalized
    const varianceScore = Math.min(variance * 100, 1.0); // Good spread of values
    const sparsityScore = 1 - sparsity; // Lower sparsity is better
    const activationScore = Math.min(maxValue * 5, 1.0); // Strong activations
    
    // Weighted combination for more distinctive quality scores
    const quality = (
      magnitudeScore * 0.3 + 
      varianceScore * 0.3 + 
      sparsityScore * 0.2 + 
      activationScore * 0.2
    );
    
    console.log(`🎯 Quality components - Magnitude: ${magnitudeScore.toFixed(3)}, Variance: ${varianceScore.toFixed(3)}, Sparsity: ${sparsityScore.toFixed(3)}, Activation: ${activationScore.toFixed(3)} → Final: ${quality.toFixed(3)}`);
    
    return quality;
  }

  /**
   * Calculate variance of embedding values
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude1 = Math.sqrt(norm1);
    const magnitude2 = Math.sqrt(norm2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Average multiple embeddings into a single representative embedding
   */
  static averageEmbeddings(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('Cannot average empty embedding array');
    }

    const dimension = embeddings[0].length;
    const averaged = new Array(dimension).fill(0);

    // Sum all embeddings
    for (const embedding of embeddings) {
      if (embedding.length !== dimension) {
        throw new Error('All embeddings must have the same dimension');
      }
      
      for (let i = 0; i < dimension; i++) {
        averaged[i] += embedding[i];
      }
    }

    // Average and normalize
    for (let i = 0; i < dimension; i++) {
      averaged[i] /= embeddings.length;
    }

    // L2 normalize the averaged embedding
    const magnitude = Math.sqrt(averaged.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimension; i++) {
        averaged[i] /= magnitude;
      }
    }

    return averaged;
  }
}

export default FaceEmbedder;