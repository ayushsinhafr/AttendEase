import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Camera, Loader2, AlertTriangle } from 'lucide-react';
import FaceCamera, { FaceCameraRef } from './FaceCamera';
import FaceEmbedder from '@/lib/face/embedder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateDeviceFingerprint, sanitizeErrorMessage } from '@/lib/face/faceUtils';

interface FaceCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  sessionId: string;
  onSuccess: (data: { similarity: number; confidence: string }) => void;
  onError: (error: string) => void;
  maxAttempts?: number;
}

interface VerificationState {
  status: 'idle' | 'capturing' | 'processing' | 'success' | 'failed';
  similarity?: number;
  confidence?: string;
  error?: string;
  attempt: number;
}

const FaceCaptureModal = ({
  open,
  onOpenChange,
  classId,
  sessionId,
  onSuccess,
  onError,
  maxAttempts = 3
}: FaceCaptureModalProps) => {
  const cameraRef = useRef<FaceCameraRef>(null);
  const { toast } = useToast();

  const [state, setState] = useState<VerificationState>({
    status: 'idle',
    attempt: 0
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setState({ status: 'idle', attempt: 0 });
      setCountdown(null);
    }
  }, [open]);

  // Countdown effect for capture
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      handleCapture();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const startCountdown = () => {
    if (!cameraReady) {
      toast({
        title: "Camera not ready",
        description: "Please wait for camera to initialize",
        variant: "destructive"
      });
      return;
    }
    setCountdown(3);
  };

  const handleCapture = async () => {
    try {
      setState(prev => ({ ...prev, status: 'capturing' }));
      setCountdown(null);

      // Capture image from camera
      const canvas = await cameraRef.current?.capture();
      if (!canvas) {
        throw new Error('Failed to capture image from camera');
      }

      setState(prev => ({ ...prev, status: 'processing' }));

      // Extract face embedding
      const embedder = FaceEmbedder.getInstance();
      const result = await embedder.extractEmbedding(canvas);

      if (!result.success || !result.embedding) {
        throw new Error(result.error || 'Failed to process face');
      }

      // Generate device fingerprint for security
      const deviceFingerprint = generateDeviceFingerprint();

      // Send to verification endpoint
      const { data, error } = await supabase.functions.invoke('verify-face-attendance', {
        body: {
          class_id: classId,
          session_id: sessionId,
          embedding: result.embedding,
          device_fingerprint: deviceFingerprint
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        if (data.code === 'LOW_SIMILARITY') {
          setState(prev => ({
            ...prev,
            status: 'failed',
            similarity: data.data?.similarity,
            error: data.message,
            attempt: prev.attempt + 1
          }));
          return;
        } else if (data.code === 'NO_FACE_PROFILE') {
          throw new Error('Face profile not found. Please enroll your face first.');
        } else {
          throw new Error(data.message || 'Verification failed');
        }
      }

      // Success!
      setState({
        status: 'success',
        similarity: data.data?.similarity,
        confidence: data.data?.confidence,
        attempt: state.attempt + 1
      });

      setTimeout(() => {
        onSuccess({
          similarity: data.data?.similarity || 0,
          confidence: data.data?.confidence || 'low'
        });
        onOpenChange(false);
      }, 2000);

    } catch (error) {
      console.error('Face capture error:', error);
      const errorMessage = sanitizeErrorMessage(error);
      
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: errorMessage,
        attempt: prev.attempt + 1
      }));

      if (state.attempt + 1 >= maxAttempts) {
        setTimeout(() => {
          onError(errorMessage);
          onOpenChange(false);
        }, 2000);
      }
    }
  };

  const handleRetry = () => {
    setState(prev => ({ ...prev, status: 'idle', error: undefined }));
  };

  const handleClose = () => {
    if (state.status === 'processing' || countdown !== null) {
      // Don't allow closing during capture/processing
      return;
    }
    onOpenChange(false);
  };

  const getStatusColor = () => {
    switch (state.status) {
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'processing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = () => {
    switch (state.status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'processing':
      case 'capturing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-600" />;
      default:
        return <Camera className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Face Verification for Attendance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Camera Component */}
          <div className="flex justify-center">
            <FaceCamera
              ref={cameraRef}
              width={320}
              height={240}
              onCameraReady={setCameraReady}
              onError={(error) => {
                setState(prev => ({ ...prev, status: 'failed', error }));
              }}
              className="rounded-lg"
            />
          </div>

          {/* Countdown Overlay */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
              <div className="text-center">
                <div className="text-6xl font-bold text-white mb-2">{countdown}</div>
                <p className="text-white">Get ready...</p>
              </div>
            </div>
          )}

          {/* Status Messages */}
          <div className="text-center">
            <div className={`text-sm font-medium ${getStatusColor()}`}>
              {state.status === 'idle' && 'Position your face in the frame and click capture'}
              {state.status === 'capturing' && 'Capturing image...'}
              {state.status === 'processing' && 'Processing face verification...'}
              {state.status === 'success' && (
                <div>
                  ✅ Face verified successfully!
                  {state.similarity && (
                    <div className="text-xs text-gray-600 mt-1">
                      Confidence: {(state.similarity * 100).toFixed(1)}% ({state.confidence})
                    </div>
                  )}
                </div>
              )}
              {state.status === 'failed' && state.error}
            </div>
          </div>

          {/* Similarity Progress (for failed attempts) */}
          {state.status === 'failed' && state.similarity && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Similarity Score</span>
                <span>{(state.similarity * 100).toFixed(1)}%</span>
              </div>
              <Progress value={state.similarity * 100} className="h-2" />
              <p className="text-xs text-gray-500 text-center">
                Minimum required: 82%
              </p>
            </div>
          )}

          {/* Attempts Counter */}
          {state.attempt > 0 && (
            <div className="text-center text-xs text-gray-500">
              Attempt {state.attempt} of {maxAttempts}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
            {state.status === 'idle' && (
              <Button
                onClick={startCountdown}
                disabled={!cameraReady}
                className="min-w-[120px]"
              >
                <Camera className="h-4 w-4 mr-2" />
                Capture Face
              </Button>
            )}

            {state.status === 'failed' && state.attempt < maxAttempts && (
              <Button
                onClick={handleRetry}
                variant="outline"
                className="min-w-[120px]"
              >
                Try Again ({maxAttempts - state.attempt} left)
              </Button>
            )}

            {(state.status === 'idle' || 
              (state.status === 'failed' && state.attempt >= maxAttempts)) && (
              <Button
                onClick={handleClose}
                variant="secondary"
                className="min-w-[120px]"
              >
                Cancel
              </Button>
            )}
          </div>

          {/* Help Text */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Tips for better verification:</strong>
              <ul className="mt-1 space-y-1">
                <li>• Ensure good lighting on your face</li>
                <li>• Remove glasses if possible</li>
                <li>• Look directly at the camera</li>
                <li>• Keep your face centered in the frame</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaceCaptureModal;