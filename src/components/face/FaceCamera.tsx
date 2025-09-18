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

      // Request camera stream with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to load
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve();
            };
          }
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

  // Capture current frame
  const capture = async (): Promise<HTMLCanvasElement | null> => {
    if (!videoRef.current || !canvasRef.current || !isActive) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    // Set canvas dimensions to video dimensions
    canvas.width = video.videoWidth || width;
    canvas.height = video.videoHeight || height;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas;
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