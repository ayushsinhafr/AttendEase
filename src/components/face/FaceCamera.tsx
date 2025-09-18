import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkCameraAccess } from '@/lib/face/faceUtils';

export interface FaceCameraRef {
  capture: () => Promise<HTMLCanvasElement | null>;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
}

interface FaceCameraProps {
  onCameraReady?: (ready: boolean) => void;
  onError?: (error: string) => void;
  className?: string;
  autoStart?: boolean;
  width?: number;
  height?: number;
}

const FaceCamera = forwardRef<FaceCameraRef, FaceCameraProps>(({
  onCameraReady,
  onError,
  className = '',
  autoStart = true,
  width = 320,
  height = 240
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Start camera stream
  const startCamera = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      // Check camera access first
      const accessCheck = await checkCameraAccess();
      if (!accessCheck.available) {
        const errorMsg = accessCheck.error || 'Camera not available';
        setError(errorMsg);
        onError?.(errorMsg);
        setHasPermission(false);
        return false;
      }

      setHasPermission(true);

      // Detect if we're on mobile for better camera constraints
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Try multiple camera constraint configurations for mobile front camera
      const constraintOptions = [
        // Option 1: Explicit front camera with ideal settings
        {
          video: {
            facingMode: { exact: 'user' },
            width: isMobile ? { ideal: 640, min: 320 } : { ideal: 640, min: 320 },
            height: isMobile ? { ideal: 480, min: 240 } : { ideal: 480, min: 240 },
            frameRate: { ideal: 30, min: 15 }
          },
          audio: false
        },
        // Option 2: Fallback with looser front camera constraints
        {
          video: {
            facingMode: 'user',
            width: { ideal: 480, min: 240 },
            height: { ideal: 360, min: 180 },
            frameRate: { ideal: 24, min: 10 }
          },
          audio: false
        },
        // Option 3: Most basic front camera request
        {
          video: {
            facingMode: 'user'
          },
          audio: false
        },
        // Option 4: Last resort - any video
        {
          video: true,
          audio: false
        }
      ];

      console.log('📱 Device type:', isMobile ? 'Mobile' : 'Desktop');
      
      let stream: MediaStream | null = null;
      let lastError: Error | null = null;
      
      // Try each constraint option until one works
      for (let i = 0; i < constraintOptions.length; i++) {
        try {
          console.log(`🔄 Trying camera constraints option ${i + 1}:`, constraintOptions[i]);
          stream = await navigator.mediaDevices.getUserMedia(constraintOptions[i]);
          
          if (stream) {
            console.log('✅ Camera stream acquired with option', i + 1);
            break;
          }
        } catch (error) {
          console.warn(`⚠️ Camera option ${i + 1} failed:`, error);
          lastError = error as Error;
          
          // If it's a permission error, don't try other options
          if ((error as any).name === 'NotAllowedError') {
            throw error;
          }
        }
      }
      
      if (!stream) {
        throw lastError || new Error('Failed to access any camera configuration');
      }

      if (videoRef.current) {
        const video = videoRef.current;
        
        // Mobile-specific video attributes for front camera
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true'); 
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        
        // Set stream
        video.srcObject = stream;
        streamRef.current = stream;
        
        console.log('📹 Video element configured with stream, mobile optimizations applied');
        
        // Wait for video to load and be ready with enhanced mobile support
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          let resolved = false;
          
          const onLoadedData = () => {
            if (resolved) return;
            resolved = true;
            
            console.log('✅ Video loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
            video.removeEventListener('loadeddata', onLoadedData);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onError);
            
            // Additional stabilization wait for mobile front camera
            if (isMobile) {
              console.log('📱 Mobile front camera stabilization wait...');
              setTimeout(() => resolve(), 1000);
            } else {
              resolve();
            }
          };
          
          const onCanPlay = () => {
            if (resolved) return;
            console.log('✅ Video can play, ready state:', video.readyState);
            onLoadedData();
          };
          
          const onError = (error: Event) => {
            if (resolved) return;
            resolved = true;
            
            console.error('❌ Video loading error:', error);
            video.removeEventListener('loadeddata', onLoadedData);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('error', onError);
            reject(new Error('Video failed to load'));
          };
          
          // Listen to multiple events for better mobile compatibility
          video.addEventListener('loadeddata', onLoadedData);
          video.addEventListener('canplay', onCanPlay);
          video.addEventListener('error', onError);
          
          // Force play for mobile
          if (isMobile) {
            video.play().catch(e => console.warn('Video play failed:', e));
          }
          
          // Fallback timeout with longer wait for mobile
          setTimeout(() => {
            if (!resolved && video.readyState >= 2) {
              console.log('⏰ Fallback timeout triggered, video ready state:', video.readyState);
              onLoadedData();
            }
          }, isMobile ? 3000 : 2000);
          
          // Ultimate fallback timeout
          setTimeout(() => {
            if (!resolved) {
              console.error('❌ Ultimate timeout - video not ready after', isMobile ? 8 : 5, 'seconds');
              reject(new Error(`Video not ready after ${isMobile ? 8 : 5} seconds`));
            }
          }, isMobile ? 8000 : 5000);
        });

        setIsActive(true);
        onCameraReady?.(true);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Camera access error:', error);
      let errorMessage = 'Failed to access camera';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera permissions and try again.';
          setHasPermission(false);
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application.';
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      setError(errorMessage);
      onError?.(errorMessage);
      setHasPermission(false);
      return false;

    } finally {
      setIsLoading(false);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    onCameraReady?.(false);
  };

  // Capture current frame with enhanced mobile front camera support
  const capture = async (): Promise<HTMLCanvasElement | null> => {
    if (!videoRef.current || !canvasRef.current || !isActive) {
      console.error('❌ Capture failed: Video, canvas, or camera not ready');
      console.log('Debug: video exists:', !!videoRef.current, 'canvas exists:', !!canvasRef.current, 'isActive:', isActive);
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Detect mobile for additional checks
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    console.log('📸 Starting capture process...', isMobile ? '[MOBILE]' : '[DESKTOP]');
    
    // Enhanced video readiness check for mobile
    if (video.readyState < 2) {
      console.error('❌ Capture failed: Video not ready (readyState:', video.readyState, ')');
      
      // Try to wait a bit longer for mobile front camera
      if (isMobile && video.readyState >= 1) {
        console.log('📱 Mobile: Attempting to wait for video to be fully ready...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (video.readyState < 2) {
          console.error('❌ Mobile: Video still not ready after wait');
          return null;
        }
      } else {
        return null;
      }
    }

    // Check video dimensions with mobile-specific handling
    let videoWidth = video.videoWidth;
    let videoHeight = video.videoHeight;
    
    // Mobile fallback: use video element size if videoWidth/Height are 0
    if ((videoWidth === 0 || videoHeight === 0) && isMobile) {
      videoWidth = video.clientWidth || width;
      videoHeight = video.clientHeight || height;
      console.log('📱 Mobile fallback: Using element dimensions:', videoWidth, 'x', videoHeight);
    }
    
    if (videoWidth === 0 || videoHeight === 0) {
      console.error('❌ Capture failed: Invalid video dimensions:', videoWidth, 'x', videoHeight);
      console.log('Debug: video.videoWidth:', video.videoWidth, 'video.videoHeight:', video.videoHeight);
      console.log('Debug: video.clientWidth:', video.clientWidth, 'video.clientHeight:', video.clientHeight);
      return null;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      console.error('❌ Capture failed: Cannot get canvas context');
      return null;
    }

    try {
      // Set canvas dimensions to video dimensions
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      
      console.log('📐 Canvas configured:', videoWidth, 'x', videoHeight);

      // Clear canvas first (important for mobile)
      context.clearRect(0, 0, videoWidth, videoHeight);
      
      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, videoWidth, videoHeight);
      
      // Verify that something was actually drawn
      const imageData = context.getImageData(0, 0, Math.min(10, videoWidth), Math.min(10, videoHeight));
      const isBlank = imageData.data.every((channel, index) => {
        // Check RGB channels (skip alpha)
        return index % 4 === 3 || channel === 0;
      });
      
      if (isBlank) {
        console.error('❌ Capture failed: Canvas appears to be blank');
        console.log('Debug: First 10x10 pixels are all black/transparent');
        return null;
      }

      console.log('✅ Image captured successfully:', videoWidth, 'x', videoHeight);
      console.log('📊 Image data sample (first pixel):', 
        imageData.data[0], imageData.data[1], imageData.data[2], imageData.data[3]);
      
      return canvas;
      
    } catch (error) {
      console.error('❌ Capture failed with error:', error);
      
      // Additional mobile-specific error info
      if (isMobile) {
        console.log('📱 Mobile debug info:');
        console.log('- Video paused:', video.paused);
        console.log('- Video ended:', video.ended);
        console.log('- Video muted:', video.muted);
        console.log('- Video currentTime:', video.currentTime);
      }
      
      return null;
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    capture,
    startCamera,
    stopCamera
  }));

  // Auto-start camera on mount
  useEffect(() => {
    if (autoStart) {
      startCamera();
    }

    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [autoStart]);

  // Handle visibility change (pause camera when tab not visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isActive) {
        // Pause video when tab is not visible
        if (videoRef.current) {
          videoRef.current.pause();
        }
      } else if (!document.hidden && isActive) {
        // Resume video when tab becomes visible
        if (videoRef.current) {
          videoRef.current.play().catch(console.warn);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive]);

  return (
    <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${isActive ? 'block' : 'hidden'}`}
        style={{ width, height }}
      />

      {/* Hidden canvas for capture */}
      <canvas
        ref={canvasRef}
        className="hidden"
      />

      {/* Loading state */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-gray-200"
          style={{ width, height }}
        >
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-600" />
            <p className="text-sm text-gray-600">Starting camera...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 border-2 border-dashed border-red-200"
          style={{ width, height }}
        >
          <CameraOff className="h-12 w-12 text-red-400 mb-3" />
          <p className="text-sm text-red-600 text-center px-4 mb-4">
            {error}
          </p>
          {hasPermission === false && (
            <Button
              onClick={() => {
                setError(null);
                startCamera();
              }}
              size="sm"
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <Camera className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      )}

      {/* Inactive state (when not auto-start) */}
      {!isActive && !isLoading && !error && !autoStart && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100"
          style={{ width, height }}
        >
          <Camera className="h-12 w-12 text-gray-400 mb-3" />
          <Button
            onClick={startCamera}
            size="sm"
            variant="outline"
          >
            Start Camera
          </Button>
        </div>
      )}

      {/* Camera guide overlay (when active) */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Face guide circle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-60 border-2 border-white rounded-full opacity-30" />
          </div>
          
          {/* Instructions */}
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-white text-sm font-medium bg-black bg-opacity-50 px-3 py-1 rounded">
              Position your face in the circle
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

FaceCamera.displayName = 'FaceCamera';

export default FaceCamera;