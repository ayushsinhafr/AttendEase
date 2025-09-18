// Use dynamic import with proper error handling
let ortModule: any = null;

import { modelPreloader } from './modelPreloader';

async function loadOnnxRuntime() {
  if (ortModule) {
    return ortModule;
  }

  try {
    // Try ES module import first
    ortModule = await import('onnxruntime-web');
    
    // Check if InferenceSession is available
    if (!ortModule.InferenceSession) {
      throw new Error('InferenceSession not found in module');
    }
    
    console.log('✅ ONNX Runtime loaded via ES module');
    return ortModule;
  } catch (error) {
    console.error('Failed to load ONNX Runtime via ES module:', error);
    
    // Fallback: try accessing global ort if available
    if (typeof window !== 'undefined' && (window as any).ort) {
      ortModule = (window as any).ort;
      console.log('✅ ONNX Runtime loaded via global');
      return ortModule;
    }
    
    throw new Error(`ONNX Runtime not available: ${error}`);
  }
}

// Configure ONNX Runtime when needed
async function configureOnnxRuntime() {
  try {
    const ort = await loadOnnxRuntime();
    if (ort.env) {
      ort.env.logLevel = 'warning';
      if (ort.env.wasm) {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.wasmPaths = 'https://huggingface.co/ayu5hsinha/qattend-face-models/resolve/main/onnx-wasm/';
      }
    }
  } catch (error) {
    console.warn('Failed to configure ONNX Runtime environment:', error);
    throw error;
  }
}

interface ModelConfig {
  name: string;
  embeddingSize: number;
  inputSize: {
    width: number;
    height: number;
    channels: number;
  };
  normalization: {
    mean: number[];
    std: number[];
  };
  format: string;
  fileName: string;
}

class FaceModelManager {
  private static instance: FaceModelManager;
  private session: any = null;
  private config: ModelConfig | null = null;
  private loading = false;

  private constructor() {}

  static getInstance(): FaceModelManager {
    if (!FaceModelManager.instance) {
      FaceModelManager.instance = new FaceModelManager();
    }
    return FaceModelManager.instance;
  }

  async loadModel(): Promise<any> {
    if (this.session) {
      return this.session;
    }

    if (this.loading) {
      // Wait for ongoing load
      while (this.loading && !this.session) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.session) return this.session;
    }

    try {
      this.loading = true;
      
      // Configure ONNX Runtime environment
      await configureOnnxRuntime();
      const ort = await loadOnnxRuntime();
      
      // Load model configuration
      const configResponse = await fetch('https://huggingface.co/ayu5hsinha/qattend-face-models/resolve/main/model-config.json');
      if (!configResponse.ok) {
        throw new Error('Failed to load model configuration');
      }
      this.config = await configResponse.json();

      // Load ONNX model
      console.log('🔄 Loading face recognition model...');
      const filename = this.config.fileName;
      
      // Use preloader to get cached model or download
      const arrayBuffer = await modelPreloader.getModel(filename);
      
      // Check if InferenceSession is available
      if (!ort.InferenceSession) {
        throw new Error('ONNX Runtime InferenceSession not available - module import failed');
      }
      
      this.session = await ort.InferenceSession.create(new Uint8Array(arrayBuffer), {
        executionProviders: ['wasm'],
        logSeverityLevel: 3,
        logVerbosityLevel: 0,
      });

      console.log('✅ Face recognition model loaded successfully');
      return this.session;

    } catch (error) {
      console.error('❌ Failed to load face recognition model:', error);
      throw new Error(`Model loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.loading = false;
    }
  }

  getConfig(): ModelConfig | null {
    return this.config;
  }

  async isModelReady(): Promise<boolean> {
    try {
      await this.loadModel();
      return true;
    } catch {
      return false;
    }
  }

  // Check if WebGL/WebGPU is available for acceleration
  static checkAccelerationSupport(): {
    webgl: boolean;
    webgpu: boolean;
  } {
    const canvas = document.createElement('canvas');
    const webglSupported = !!(
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    );

    const webgpuSupported = 'gpu' in navigator;

    return {
      webgl: webglSupported,
      webgpu: webgpuSupported
    };
  }

  // Preload model in background
  static preloadModel(): void {
    setTimeout(() => {
      FaceModelManager.getInstance().loadModel().catch(console.warn);
    }, 2000); // Preload after 2 seconds
  }
}

export default FaceModelManager;