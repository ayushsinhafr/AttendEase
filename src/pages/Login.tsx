import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { GraduationCap, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  uniqueId: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const { toast } = useToast();

  // Check for verification success message
  const verificationMessage = location.state?.message;
  const prefilledEmail = location.state?.email;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      uniqueId: prefilledEmail || "",
      rememberMe: false,
    },
  });

  const watchRememberMe = watch("rememberMe");

  // Load saved credentials on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('qattend_saved_email');
    const savedPassword = localStorage.getItem('qattend_saved_password');
    const rememberMe = localStorage.getItem('qattend_remember_me') === 'true';

    if (savedEmail && rememberMe && !prefilledEmail) {
      setValue("uniqueId", savedEmail);
      setValue("rememberMe", true);
    }
    if (savedPassword && rememberMe && !prefilledEmail) {
      setValue("password", savedPassword);
    }
    if (prefilledEmail) {
      setValue("uniqueId", prefilledEmail);
    }
  }, [prefilledEmail, setValue]);

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    
    try {
      const { error } = await signIn(data.uniqueId, data.password);
      
      if (error) {
        toast({
          title: "Login failed",
          description: error.message || "Please check your credentials and try again.",
          variant: "destructive",
        });
      } else {
        // Save credentials if remember me is checked
        if (data.rememberMe) {
          localStorage.setItem('qattend_saved_email', data.uniqueId);
          localStorage.setItem('qattend_saved_password', data.password);
          localStorage.setItem('qattend_remember_me', 'true');
        } else {
          // Clear saved credentials if remember me is not checked
          localStorage.removeItem('qattend_saved_email');
          localStorage.removeItem('qattend_saved_password');
          localStorage.removeItem('qattend_remember_me');
        }

        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        });
        
        navigate("/dashboard");
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-neutral-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card border-0 shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur opacity-75"></div>
              <img src="/LOGO.png" alt="QAttend Logo" className="relative h-14 w-14 rounded-2xl shadow-lg" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">Welcome Back</CardTitle>
          <CardDescription className="text-neutral-600 dark:text-neutral-400 text-base">
            Sign in to your QAttend account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Verification Success Message */}
          {verificationMessage && (
            <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                {verificationMessage}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="uniqueId" className="text-neutral-700 dark:text-neutral-300 font-medium">Email Address</Label>
              <Input
                id="uniqueId"
                type="email"
                placeholder="Enter your email"
                {...register("uniqueId")}
                className={`h-12 ${errors.uniqueId ? "border-red-300 focus:border-red-400" : "border-neutral-200 focus:border-brand-400"}`}
              />
              {errors.uniqueId && (
                <p className="text-sm text-red-600">{errors.uniqueId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="text-neutral-700 dark:text-neutral-300 font-medium">Password</Label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...register("password")}
                autoComplete="current-password"
                className={`h-12 ${errors.password ? "border-red-300 focus:border-red-400" : "border-neutral-200 focus:border-brand-400"}`}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rememberMe"
                {...register("rememberMe")}
                checked={watchRememberMe}
                onCheckedChange={(checked) => setValue("rememberMe", checked as boolean)}
              />
              <Label htmlFor="rememberMe" className="text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer">
                Remember my login credentials
              </Label>
            </div>

            <Button type="submit" className="w-full btn-primary h-12 text-base font-medium" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>

          <div className="space-y-4 text-center">
            <p className="text-sm text-neutral-600">
              Don't have an account?{" "}
              <Link 
                to="/register" 
                className="text-brand-600 hover:text-brand-700 font-semibold hover:underline transition-colors"
              >
                Register here
              </Link>
            </p>
            <Link 
              to="/" 
              className="text-sm text-neutral-500 hover:text-neutral-700 hover:underline transition-colors inline-block"
            >
              ← Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;