// Model preloader to download models in background
class ModelPreloader {
  private static instance: ModelPreloader;
  private preloadPromise: Promise<void> | null = null;
  private modelCache: Map<string, ArrayBuffer> = new Map();

  static getInstance(): ModelPreloader {
    if (!ModelPreloader.instance) {
      ModelPreloader.instance = new ModelPreloader();
    }
    return ModelPreloader.instance;
  }

  // Start preloading models in background
  async startPreloading(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = this.preloadModels();
    return this.preloadPromise;
  }

  private async preloadModels(): Promise<void> {
    try {
      console.log('🔄 Starting background model preload...');
      
      const baseUrl = 'https://huggingface.co/ayu5hsinha/qattend-face-models/resolve/main/';
      
      // Preload config first (small file)
      const configUrl = `${baseUrl}model-config.json`;
      const configResponse = await fetch(configUrl);
      if (!configResponse.ok) throw new Error('Failed to load config');
      const config = await configResponse.json();
      
      // Preload model files
      const modelUrls = [
        `${baseUrl}${config.fileName}`, // facenet.onnx
        `${baseUrl}detection.onnx`
      ];

      const downloadPromises = modelUrls.map(async (url) => {
        try {
          console.log(`🔽 Preloading: ${url.split('/').pop()}`);
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch ${url}`);
          
          const arrayBuffer = await response.arrayBuffer();
          const filename = url.split('/').pop() || url;
          this.modelCache.set(filename, arrayBuffer);
          
          console.log(`✅ Preloaded: ${filename} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
        } catch (error) {
          console.warn(`⚠️ Failed to preload ${url}:`, error);
        }
      });

      await Promise.all(downloadPromises);
      console.log('🎉 Model preloading completed!');
    } catch (error) {
      console.error('❌ Model preloading failed:', error);
    }
  }

  // Get cached model or download if not cached
  async getModel(filename: string): Promise<ArrayBuffer> {
    // Wait for preloading to complete
    if (this.preloadPromise) {
      await this.preloadPromise;
    }

    // Return cached model if available
    if (this.modelCache.has(filename)) {
      console.log(`🚀 Using cached model: ${filename}`);
      return this.modelCache.get(filename)!;
    }

    // Fallback: download now if not preloaded
    console.log(`⚠️ Model not preloaded, downloading now: ${filename}`);
    const baseUrl = 'https://huggingface.co/ayu5hsinha/qattend-face-models/resolve/main/';
    const response = await fetch(`${baseUrl}${filename}`);
    if (!response.ok) throw new Error(`Failed to fetch ${filename}`);
    
    const arrayBuffer = await response.arrayBuffer();
    this.modelCache.set(filename, arrayBuffer);
    return arrayBuffer;
  }

  // Check if models are preloaded
  isPreloaded(): boolean {
    return this.modelCache.size > 0;
  }

  // Get preload progress
  getPreloadStatus(): { total: number; loaded: number; isComplete: boolean } {
    const total = 2; // facenet.onnx + detection.onnx
    const loaded = this.modelCache.size;
    return {
      total,
      loaded,
      isComplete: loaded >= total
    };
  }
}

export const modelPreloader = ModelPreloader.getInstance();