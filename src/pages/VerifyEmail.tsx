import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";

const VerifyEmail = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false); // Prevent duplicate checks
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Get email from URL params
  const email = searchParams.get("email");
  const type = searchParams.get("type") || "signup";

  useEffect(() => {
    if (!email) {
      navigate("/register");
      return;
    }

    // Only check user status if not currently verifying
    if (isVerifying) return;

    // Check if user is already verified and has a profile
    const checkUserStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email_confirmed_at) {
        // Check if user has a profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          toast({
            title: "Already verified",
            description: "Your email is already verified. Redirecting to login...",
          });
          navigate("/login", {
            state: { 
              message: "Your email is already verified. Please sign in.",
              email: email 
            }
          });
          return;
        }
      }
    };

    checkUserStatus();
  }, [email, navigate, type, toast, isVerifying]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setLoading(true);
    setError("");
    setIsVerifying(true); // Prevent duplicate status checks

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email!,
        token: otp,
        type: type as any,
      });

      if (verifyError) {
        throw verifyError;
      }

      if (data.user) {
        toast({
          title: "Email Verified!",
          description: "Your email has been successfully verified. You can now sign in.",
        });

        // Redirect to login page with success message
        navigate("/login", {
          state: { 
            message: "Email verified successfully! Please sign in with your credentials.",
            email: email 
          }
        });
      }
    } catch (error: any) {
      console.error("OTP verification error:", error);
      
      if (error.message?.includes("expired")) {
        setError("The verification code has expired. Please request a new one.");
      } else if (error.message?.includes("invalid")) {
        setError("Invalid verification code. Please check and try again.");
      } else {
        setError(error.message || "Failed to verify email. Please try again.");
      }
      setIsVerifying(false); // Reset flag on error
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email || countdown > 0) return;

    setResending(true);
    setError("");

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: type as any,
        email: email,
      });

      if (resendError) {
        throw resendError;
      }

      toast({
        title: "Code Sent!",
        description: "A new verification code has been sent to your email.",
      });

      setCountdown(60); // 60 second countdown
      setOtp(""); // Clear current OTP
    } catch (error: any) {
      console.error("Resend OTP error:", error);
      setError(error.message || "Failed to resend verification code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleBackToRegister = () => {
    navigate("/register");
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      {/* Header */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <Card className="glass-card border-0 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur opacity-75"></div>
                <div className="relative bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-lg">
                  <Mail className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gradient">Verify Your Email</CardTitle>
            <CardDescription className="text-neutral-600 text-base">
              We've sent a 6-digit verification code to
              <br />
              <span className="font-medium text-blue-600">{email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8">
            <div className="space-y-6">
              {/* OTP Input */}
              <div className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => {
                      setOtp(value);
                      setError("");
                    }}
                    disabled={loading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Verify Button */}
              <Button
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>

              {/* Resend Code */}
              <div className="text-center">
                <p className="text-sm text-neutral-600 mb-2">
                  Didn't receive the code?
                </p>
                <Button
                  variant="ghost"
                  onClick={handleResendOTP}
                  disabled={resending || countdown > 0}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 font-medium"
                >
                  {resending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : countdown > 0 ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend in {countdown}s
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend Code
                    </>
                  )}
                </Button>
              </div>

              {/* Back to Register */}
              <div className="text-center pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <Button
                  variant="ghost"
                  onClick={handleBackToRegister}
                  className="text-neutral-600 hover:text-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Registration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Check your spam folder if you don't see the email.
            <br />
            The verification code expires in 10 minutes.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;