import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  User, 
  Shield, 
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Eye,
  RotateCw
} from 'lucide-react';
import FaceCamera, { FaceCameraRef } from '@/components/face/FaceCamera';
import FaceEmbedder from '@/lib/face/embedder';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { generateDeviceFingerprint, sanitizeErrorMessage } from '@/lib/face/faceUtils';
import { withNetworkErrorHandling } from '@/lib/networkUtils';

interface EnrollmentStep {
  id: number;
  title: string;
  description: string;
  instruction: string;
  angle?: string;
}

interface CapturedSample {
  id: number;
  embedding: number[];
  quality: number;
  timestamp: number;
  preview?: string; // base64 image for preview
}

const ENROLLMENT_STEPS: EnrollmentStep[] = [
  {
    id: 1,
    title: "Front View",
    description: "Look directly at the camera",
    instruction: "Keep your face centered and look straight ahead",
    angle: "front"
  },
  {
    id: 2,
    title: "Slight Right",
    description: "Turn your head slightly to the right",
    instruction: "Turn your head about 15 degrees to the right",
    angle: "right"
  },
  {
    id: 3,
    title: "Slight Left", 
    description: "Turn your head slightly to the left",
    instruction: "Turn your head about 15 degrees to the left",
    angle: "left"
  },
  {
    id: 4,
    title: "Slight Up",
    description: "Tilt your head slightly upward",
    instruction: "Lift your chin slightly while looking at the camera",
    angle: "up"
  },
  {
    id: 5,
    title: "Natural Smile",
    description: "Smile naturally at the camera",
    instruction: "Give a natural, friendly smile",
    angle: "smile"
  }
];

type EnrollmentPhase = 'consent' | 'preparation' | 'capture' | 'processing' | 'complete' | 'error';

const FaceEnrollment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const cameraRef = useRef<FaceCameraRef>(null);

  // Check if this is first-time enrollment (mandatory)
  const isFirstTime = location.state?.isFirstTime || false;
  const welcomeMessage = location.state?.message;

  const [phase, setPhase] = useState<EnrollmentPhase>('consent');
  const [currentStep, setCurrentStep] = useState(0);
  const [samples, setSamples] = useState<CapturedSample[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication for face enrollment
  useEffect(() => {
    const checkAuth = async () => {
      // If this is first-time enrollment, allow access even without full authentication
      if (isFirstTime) {
        console.log('First-time enrollment, allowing access');
        return;
      }
      
      // For regular access, require authentication
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to access face enrollment.",
          variant: "destructive",
        });
        navigate('/login');
      }
    };

    checkAuth();
  }, [user, isFirstTime, navigate, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cameraRef.current?.stopCamera();
    };
  }, []);

  // Countdown effect
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
      setIsProcessing(true);
      setError(null);

      // Capture image from camera
      const canvas = await cameraRef.current?.capture();
      if (!canvas) {
        throw new Error('Failed to capture image');
      }

      // Extract face embedding
      const embedder = FaceEmbedder.getInstance();
      const result = await embedder.extractEmbedding(canvas);

      if (!result.success || !result.embedding) {
        throw new Error(result.error || 'Failed to process face');
      }

      // Create preview image
      const previewDataUrl = canvas.toDataURL('image/jpeg', 0.7);

      // Store sample
      const sample: CapturedSample = {
        id: currentStep + 1,
        embedding: result.embedding,
        quality: result.quality || 0,
        timestamp: Date.now(),
        preview: previewDataUrl
      };

      setSamples(prev => [...prev, sample]);

      // Move to next step or complete
      if (currentStep + 1 >= ENROLLMENT_STEPS.length) {
        setPhase('processing');
        await submitEnrollment([...samples, sample]);
      } else {
        setCurrentStep(currentStep + 1);
      }

      toast({
        title: "Sample captured",
        description: `Step ${currentStep + 1} completed successfully`
      });

    } catch (error) {
      console.error('Capture error:', error);
      const errorMessage = sanitizeErrorMessage(error);
      setError(errorMessage);
      toast({
        title: "Capture failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setCountdown(null);
    }
  };

  const submitEnrollment = async (allSamples: CapturedSample[]) => {
    try {
      const deviceFingerprint = generateDeviceFingerprint();
      const embeddings = allSamples.map(sample => sample.embedding);

      const { data, error } = await withNetworkErrorHandling(
        async () => supabase.functions.invoke('store-face-profile', {
          body: {
            embeddings,
            deviceFingerprint
          }
        }),
        'Failed to store face profile due to network error'
      );

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to store face profile');
      }

      setPhase('complete');
      
      if (isFirstTime) {
        toast({
          title: "Welcome to AttendEasy!",
          description: "Face enrollment complete! You can now mark attendance using face recognition.",
        });
      } else {
        toast({
          title: "Enrollment complete!",
          description: "Your face profile has been updated successfully",
        });
      }

      // Auto-redirect after success
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);

    } catch (error) {
      console.error('Enrollment submission error:', error);
      const errorMessage = sanitizeErrorMessage(error);
      setError(errorMessage);
      setPhase('error');
      
      toast({
        title: "Enrollment failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const resetEnrollment = () => {
    setSamples([]);
    setCurrentStep(0);
    setError(null);
    setPhase('preparation');
  };

  const retryCapture = () => {
    setError(null);
    setIsProcessing(false);
    setCountdown(null);
  };

  // Consent Phase
  if (phase === 'consent') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100/50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            {!isFirstTime && (
              <Button 
                variant="ghost" 
                onClick={() => navigate('/dashboard')}
                className="mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            )}
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit">
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle>
                {isFirstTime ? "Complete Your Face Enrollment" : "Face Recognition Enrollment"}
              </CardTitle>
              <CardDescription>
                {isFirstTime 
                  ? "To secure your attendance verification, please capture your face from multiple angles. This is required to access the system."
                  : "Set up face recognition for secure attendance marking. Your face data is encrypted and stored securely."
                }
              </CardDescription>
              {welcomeMessage && (
                <Alert className="mt-4">
                  <AlertDescription>{welcomeMessage}</AlertDescription>
                </Alert>
              )}
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">How it works:</h3>
                <div className="grid gap-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Capture face samples</p>
                      <p className="text-sm text-gray-600">We'll take 5 photos from different angles for better accuracy</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Secure processing</p>
                      <p className="text-sm text-gray-600">Your photos are converted to mathematical patterns (embeddings) and original photos are never stored</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Quick attendance</p>
                      <p className="text-sm text-gray-600">When marking attendance, your face will be verified instantly</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Privacy & Security:</strong>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Only mathematical representations (embeddings) are stored, not your photos</li>
                    <li>• Data is encrypted and secure</li>
                    <li>• You can delete your face data anytime</li>
                    <li>• Face verification is optional - you can always use QR codes</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="flex gap-3">
                <Button
                  onClick={() => setPhase('preparation')}
                  className="flex-1"
                >
                  <User className="h-4 w-4 mr-2" />
                  I Consent & Continue
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main enrollment interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100/50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          {!isFirstTime && (
            <Button 
              variant="ghost" 
              onClick={() => navigate('/dashboard')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          )}
        </div>

        {/* Progress Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Face Enrollment Progress</h2>
                <Badge variant={phase === 'complete' ? 'default' : 'secondary'}>
                  {samples.length} / {ENROLLMENT_STEPS.length} samples
                </Badge>
              </div>
              <Progress 
                value={(samples.length / ENROLLMENT_STEPS.length) * 100} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Camera Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                {phase === 'capture' ? ENROLLMENT_STEPS[currentStep]?.title : 'Camera Preview'}
              </CardTitle>
              {phase === 'capture' && (
                <CardDescription>
                  {ENROLLMENT_STEPS[currentStep]?.instruction}
                </CardDescription>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="relative">
                {phase === 'preparation' || phase === 'capture' ? (
                  <FaceCamera
                    ref={cameraRef}
                    width={400}
                    height={300}
                    onCameraReady={setCameraReady}
                    onError={setError}
                    className="w-full"
                  />
                ) : phase === 'processing' ? (
                  <div className="w-full h-[300px] bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Processing enrollment...</p>
                    </div>
                  </div>
                ) : phase === 'complete' ? (
                  <div className="w-full h-[300px] bg-green-50 rounded-lg flex items-center justify-center border-2 border-green-200">
                    <div className="text-center">
                      <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-green-800">Enrollment Complete!</h3>
                      <p className="text-sm text-green-600">Redirecting to dashboard...</p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-[300px] bg-red-50 rounded-lg flex items-center justify-center border-2 border-red-200">
                    <div className="text-center">
                      <XCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-red-800">Enrollment Failed</h3>
                      <p className="text-sm text-red-600 mb-4">{error}</p>
                      <Button onClick={resetEnrollment} size="sm">
                        <RotateCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}

                {/* Countdown Overlay */}
                {countdown !== null && countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-6xl font-bold text-white mb-2">{countdown}</div>
                      <p className="text-white">Get ready...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {phase === 'preparation' && (
                <div className="text-center">
                  <Button
                    onClick={() => setPhase('capture')}
                    disabled={!cameraReady}
                    size="lg"
                  >
                    Start Enrollment
                  </Button>
                </div>
              )}

              {phase === 'capture' && (
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={startCountdown}
                    disabled={!cameraReady || isProcessing || countdown !== null}
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : countdown !== null ? (
                      'Capturing...'
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Capture Sample
                      </>
                    )}
                  </Button>
                  
                  {error && (
                    <Button
                      onClick={retryCapture}
                      variant="outline"
                      size="lg"
                    >
                      Retry
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Progress Section */}
          <Card>
            <CardHeader>
              <CardTitle>Enrollment Steps</CardTitle>
              <CardDescription>
                Complete all steps for better accuracy
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {ENROLLMENT_STEPS.map((step, index) => {
                const isComplete = samples.some(s => s.id === step.id);
                const isCurrent = phase === 'capture' && index === currentStep;
                const sample = samples.find(s => s.id === step.id);

                return (
                  <div
                    key={step.id}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50'
                        : isComplete
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isComplete
                          ? 'bg-green-500 text-white'
                          : isCurrent
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {isComplete ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : isCurrent ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          step.id
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <p className="font-medium">{step.title}</p>
                        <p className="text-sm text-gray-600">{step.description}</p>
                        {sample && (
                          <div className="text-xs text-green-600 mt-1">
                            Quality: {(sample.quality * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FaceEnrollment;