/**
 * Utility functions for face recognition and security
 */

export interface DeviceFingerprint {
  hash: string;
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  screen: string;
  timestamp: number;
}

export interface SecurityMetrics {
  isLiveCapture: boolean;
  deviceFingerprint: DeviceFingerprint;
  captureQuality: number;
  timestamp: number;
}

/**
 * Generate device fingerprint for anti-abuse tracking
 */
export function generateDeviceFingerprint(): DeviceFingerprint {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Create a simple canvas fingerprint
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Face verification fingerprint', 2, 2);
  }
  
  const canvasFingerprint = canvas.toDataURL();
  
  const fingerprint = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    canvas: canvasFingerprint
  };

  // Create hash of fingerprint
  const fingerprintString = JSON.stringify(fingerprint);
  const hash = simpleHash(fingerprintString);

  return {
    hash,
    userAgent: navigator.userAgent.substring(0, 100), // Truncate for storage
    platform: navigator.platform,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    timestamp: Date.now()
  };
}

/**
 * Simple hash function for fingerprinting
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Hash IP address for privacy-preserving storage
 */
export function hashIP(ip: string): string {
  // Simple hash that preserves some geographic info while anonymizing
  const parts = ip.split('.');
  if (parts.length === 4) {
    // Keep first two octets, hash the rest
    return `${parts[0]}.${parts[1]}.${simpleHash(parts[2] + parts[3])}`;
  }
  return simpleHash(ip);
}

/**
 * Validate embedding format and dimensions
 */
export function validateEmbedding(embedding: any, expectedDimension = 512): {
  valid: boolean;
  error?: string;
} {
  if (!Array.isArray(embedding)) {
    return { valid: false, error: 'Embedding must be an array' };
  }

  if (embedding.length !== expectedDimension) {
    return { 
      valid: false, 
      error: `Embedding dimension mismatch. Expected ${expectedDimension}, got ${embedding.length}` 
    };
  }

  if (!embedding.every(val => typeof val === 'number' && isFinite(val))) {
    return { valid: false, error: 'Embedding contains invalid values' };
  }

  // Check for all-zero embedding
  if (embedding.every(val => val === 0)) {
    return { valid: false, error: 'Embedding cannot be all zeros' };
  }

  return { valid: true };
}

/**
 * Calculate embedding quality metrics (improved for better compatibility)
 */
export function calculateEmbeddingQuality(embedding: number[]): number {
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
  const variance = embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / embedding.length;
  
  // Improved normalization for better compatibility
  // Face embeddings are usually L2-normalized, so magnitude should be close to 1
  const magnitudeScore = Math.min(Math.max(magnitude / 1.2, 0.1), 1.0);
  const varianceScore = Math.min(Math.max(variance / 0.05, 0.1), 1.0);
  
  // Give more weight to magnitude as it's more reliable for face embeddings
  const qualityScore = (magnitudeScore * 0.7 + varianceScore * 0.3);
  
  return Math.max(qualityScore, 0.1); // Ensure minimum quality of 0.1
}

/**
 * Check if camera access is available
 */
export async function checkCameraAccess(): Promise<{
  available: boolean;
  error?: string;
}> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { available: false, error: 'Camera API not supported' };
    }

    // Test camera access
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user' } 
    });
    
    // Clean up test stream
    stream.getTracks().forEach(track => track.stop());
    
    return { available: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Camera access denied';
    return { available: false, error: errorMessage };
  }
}

/**
 * Format similarity score for display
 */
export function formatSimilarity(similarity: number): string {
  return `${(similarity * 100).toFixed(1)}%`;
}

/**
 * Determine verification status based on similarity and threshold
 */
export function getVerificationStatus(similarity: number, threshold: number): {
  status: 'success' | 'low_similarity' | 'failed';
  confidence: 'high' | 'medium' | 'low';
  message: string;
} {
  const confidenceThresholds = {
    high: threshold + 0.05,
    medium: threshold + 0.02
  };

  if (similarity >= threshold) {
    const confidence = similarity >= confidenceThresholds.high ? 'high' : 
                     similarity >= confidenceThresholds.medium ? 'medium' : 'low';
    
    return {
      status: 'success',
      confidence,
      message: `Face verified with ${formatSimilarity(similarity)} confidence`
    };
  }

  return {
    status: 'low_similarity',
    confidence: 'low',
    message: `Face similarity too low: ${formatSimilarity(similarity)} (required: ${formatSimilarity(threshold)})`
  };
}

/**
 * Rate limiting check for verification attempts
 */
export class VerificationRateLimit {
  private static attempts = new Map<string, number[]>();
  
  static checkRateLimit(userId: string, maxAttempts = 5, windowMinutes = 10): {
    allowed: boolean;
    attemptsRemaining: number;
  } {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    
    // Get user's recent attempts
    const userAttempts = this.attempts.get(userId) || [];
    
    // Filter to only recent attempts
    const recentAttempts = userAttempts.filter(timestamp => now - timestamp < windowMs);
    
    // Update attempts list
    this.attempts.set(userId, recentAttempts);
    
    const allowed = recentAttempts.length < maxAttempts;
    const attemptsRemaining = Math.max(0, maxAttempts - recentAttempts.length);
    
    if (allowed) {
      // Record this attempt
      recentAttempts.push(now);
      this.attempts.set(userId, recentAttempts);
    }
    
    return { allowed, attemptsRemaining };
  }
  
  static reset(userId: string): void {
    this.attempts.delete(userId);
  }
}

/**
 * Browser capability detection
 */
export function detectBrowserCapabilities(): {
  webgl: boolean;
  webgpu: boolean;
  webworkers: boolean;
  wasm: boolean;
} {
  const canvas = document.createElement('canvas');
  
  return {
    webgl: !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    webgpu: 'gpu' in navigator,
    webworkers: typeof Worker !== 'undefined',
    wasm: typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'
  };
}

/**
 * Log face recognition events for debugging and monitoring
 */
export function logFaceEvent(
  event: 'enrollment' | 'verification' | 'error' | 'config_update',
  data: Record<string, any>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...data
  };
  
  console.log(`🔍 [FaceRecognition] ${event}:`, logEntry);
  
  // Could extend this to send to analytics service
}

/**
 * Sanitize error messages for client display
 */
export function sanitizeErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    // Map technical errors to user-friendly messages
    const friendlyMessages: Record<string, string> = {
      'Model loading failed': 'Face recognition is temporarily unavailable. Please try again or use QR code only.',
      'Camera access denied': 'Please allow camera access to use face verification.',
      'Invalid model output': 'Face recognition error. Please try again.',
      'Rate limit exceeded': 'Too many attempts. Please wait a few minutes before trying again.'
    };
    
    return friendlyMessages[error.message] || 'An unexpected error occurred. Please try again.';
  }
  
  return 'An unexpected error occurred. Please try again.';
}