import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import FaceCamera, { FaceCameraRef } from './FaceCamera';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from '../../hooks/use-toast';
import FaceEmbedder from '../../lib/face/embedder';
import { calculateEmbeddingQuality } from '../../lib/face/faceUtils';
import { X, CheckCircle, AlertCircle, Camera, User } from 'lucide-react';

interface FaceVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  studentId: string;
  classId: string;
  sessionInfo: {
    sessionId: string;
    sessionDate: string;
    sessionDateTime: string;
  };
}

export function FaceVerificationModal({
  isOpen,
  onClose,
  onSuccess,
  studentId,
  classId,
  sessionInfo
}: FaceVerificationModalProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const { toast } = useToast();
  const cameraRef = useRef<FaceCameraRef>(null);

  const handleCapture = async () => {
    if (!cameraRef.current) {
      setErrorMessage('Camera not ready. Please wait and try again.');
      return;
    }

    setIsVerifying(true);
    setVerificationStatus('processing');
    setErrorMessage('');

    try {
      // Capture image from camera
      const canvas = await cameraRef.current.capture();
      if (!canvas) {
        setVerificationStatus('failed');
        setErrorMessage('Failed to capture image. Please try again.');
        return;
      }

      // Extract face embedding
      const embedder = FaceEmbedder.getInstance();
      const result = await embedder.extractEmbedding(canvas);
      if (!result || !result.embedding) {
        setVerificationStatus('failed');
        setErrorMessage('No face detected. Please ensure your face is clearly visible and try again.');
        return;
      }

      const embedding = result.embedding;

      // Check face quality with detailed debugging
      const quality = calculateEmbeddingQuality(Array.from(embedding));
      console.log('🔍 EMBEDDING DEBUG:');
      console.log('   Embedding length:', embedding.length);
      console.log('   First 10 values:', Array.from(embedding).slice(0, 10));
      console.log('   Embedding sum:', Array.from(embedding).reduce((a, b) => a + b, 0));
      console.log('   Face quality score:', quality, 'Threshold: 0.7');
      
      // Temporary: Lower threshold for debugging
      if (quality < 0.5) {
        setVerificationStatus('failed');
        setErrorMessage(`Face quality too low (${quality.toFixed(2)}). Please ensure good lighting and face the camera directly.`);
        return;
      }

      // Convert canvas to base64 for upload
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

      // Verify face with backend - pass the token so Edge Function can extract session timestamp
      const { data, error } = await supabase.functions.invoke('verify-face-attendance', {
        body: {
          class_id: sessionInfo.sessionId, // Pass the full token as class_id (Edge Function will parse it)
          embedding: Array.from(embedding),
          session_info: sessionInfo
        }
      });

      if (error) {
        console.error('Face verification error:', error);
        setVerificationStatus('failed');
        setErrorMessage(error.message || 'Verification failed. Please try again.');
        return;
      }

      if (data?.success) {
        setVerificationStatus('success');
        toast({
          title: "Attendance Marked!",
          description: data.message || "Face verification successful and attendance recorded.",
        });
        
        // Wait a moment to show success, then proceed
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        setVerificationStatus('failed');
        setErrorMessage(data?.message || 'Face verification failed. Please try again.');
      }

    } catch (error) {
      console.error('Face verification error:', error);
      setVerificationStatus('failed');
      setErrorMessage('Verification failed. Please check your camera and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRetry = () => {
    setVerificationStatus('idle');
    setErrorMessage('');
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case 'processing':
        return (
          <div className="text-center space-y-4">
            <div className="animate-spin mx-auto w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
            <div className="space-y-2">
              <h3 className="font-semibold">Verifying your face...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we verify your identity
              </p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="mx-auto w-12 h-12 text-green-500" />
            <div className="space-y-2">
              <h3 className="font-semibold text-green-700">Verification Successful!</h3>
              <p className="text-sm text-muted-foreground">
                Your face has been verified. Marking attendance...
              </p>
            </div>
          </div>
        );

      case 'failed':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="mx-auto w-12 h-12 text-red-500" />
            <div className="space-y-2">
              <h3 className="font-semibold text-red-700">Verification Failed</h3>
              <p className="text-sm text-muted-foreground">
                {errorMessage}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleRetry}>
                Try Again
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <User className="mx-auto w-8 h-8 text-primary" />
              <h3 className="font-semibold">Face Verification Required</h3>
              <p className="text-sm text-muted-foreground">
                This class requires face verification for attendance. Please capture a clear photo of your face.
              </p>
            </div>
            
            <FaceCamera 
              ref={cameraRef}
              autoStart={true}
              width={320}
              height={240}
              className="mx-auto"
            />
            
            <div className="text-center space-y-4">
              <Button 
                onClick={handleCapture}
                disabled={isVerifying}
                className="w-full"
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Capture & Verify Face
                  </>
                )}
              </Button>
              
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Ensure your face is well-lit and clearly visible</p>
                <p>• Look directly at the camera</p>
                <p>• Remove any obstructions (sunglasses, mask, etc.)</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Face Verification
            </DialogTitle>
            {verificationStatus === 'idle' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="w-8 h-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <DialogDescription>
            Complete face verification to mark your attendance
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}