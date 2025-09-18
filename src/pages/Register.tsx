import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GraduationCap, Loader2, Check, X, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/^(?=.*[a-z])/, "Password must contain at least one lowercase letter")
  .regex(/^(?=.*[A-Z])/, "Password must contain at least one uppercase letter") 
  .regex(/^(?=.*\d)/, "Password must contain at least one number")
  .regex(/^(?=.*[@#$%^&*!+=?])/, "Password must contain at least one special character (@#$%^&*!+=?)")
  .regex(/^[^_-]*$/, "Password cannot contain underscores (_) or hyphens (-)");

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  uniqueId: z.string().min(1, "Registration number is required"),
  password: passwordSchema,
  confirmPassword: z.string(),
  role: z.enum(["faculty", "student"], {
    message: "Please select your role",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const selectedRole = watch("role");
  const passwordValue = watch("password");

  // Password strength validation
  const getPasswordRequirements = (password: string) => {
    return {
      minLength: password.length >= 8,
      hasLowercase: /[a-z]/.test(password),
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[@#$%^&*!+=?]/.test(password),
      noForbiddenChars: !/[_-]/.test(password),
    };
  };

  const requirements = getPasswordRequirements(passwordValue || "");
  const isPasswordStrong = Object.values(requirements).every(Boolean);

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    console.log("🔥 [Register] Starting registration process...", { email: data.email, role: data.role });
    
    try {
      const result = await signUp({
        email: data.email,
        password: data.password,
        name: data.name,
        uniqueId: data.uniqueId,
        role: data.role,
      });
      
      console.log("🔥 [Register] SignUp result:", result);
      
      if (result.error) {
        console.log("❌ [Register] SignUp error:", result.error);
        if (result.error.message?.includes("already registered")) {
          toast({
            title: "Account already exists",
            description: "This email is already registered. Please try logging in instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Registration failed",
            description: result.error.message || "Please try again with different details.",
            variant: "destructive",
          });
        }
      } else {
        console.log("✅ [Register] Registration successful, redirecting to verification...");
        // Always redirect to email verification page, regardless of confirmation status
        toast({
          title: "Registration successful!",
          description: "Please check your email for a verification code to complete your registration.",
        });
        
        const verifyUrl = `/verify-email?email=${encodeURIComponent(data.email)}&type=signup`;
        console.log("🔥 [Register] Navigating to:", verifyUrl);
        navigate(verifyUrl);
      }
    } catch (error) {
      console.log("❌ [Register] Unexpected error:", error);
      toast({
        title: "Registration failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card border-0 shadow-2xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur opacity-75"></div>
              <img src="/LOGO.png" alt="QAttend Logo" className="relative h-14 w-14 p-1 rounded-2xl shadow-lg" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-gradient">Create Account</CardTitle>
          <CardDescription className="text-neutral-600 dark:text-neutral-400 text-base">
            Join QAttend to manage attendance
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-neutral-700 dark:text-neutral-300 font-medium">Full Name</Label>
              <Input
                id="name"
                placeholder="Enter your full name"
                {...register("name")}
                className={`h-11 input-field ${errors.name ? "border-red-300 focus:border-red-500 dark:border-red-500 dark:focus:border-red-400" : ""}`}
              />
              {errors.name && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="text-xs">⚠</span>
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-700 dark:text-neutral-300 font-medium">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register("email")}
                className={`h-11 input-field ${errors.email ? "border-red-300 focus:border-red-500 dark:border-red-500 dark:focus:border-red-400" : ""}`}
              />
              {errors.email && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="text-xs">⚠</span>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-neutral-700 dark:text-neutral-300 font-medium">Role</Label>
              <RadioGroup
                value={selectedRole}
                onValueChange={(value) => setValue("role", value as "faculty" | "student")}
                className="flex flex-col space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 bg-white/30 dark:bg-slate-800/30 rounded-lg border border-neutral-200 dark:border-slate-600 hover:border-brand-300 dark:hover:border-brand-500 transition-colors">
                  <RadioGroupItem value="faculty" id="faculty" className="text-brand-600 dark:text-brand-400" />
                  <Label htmlFor="faculty" className="cursor-pointer text-neutral-700 dark:text-neutral-300 font-medium">
                    Faculty Member
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 bg-white/30 dark:bg-slate-800/30 rounded-lg border border-neutral-200 dark:border-slate-600 hover:border-brand-300 dark:hover:border-brand-500 transition-colors">
                  <RadioGroupItem value="student" id="student" className="text-brand-600 dark:text-brand-400" />
                  <Label htmlFor="student" className="cursor-pointer text-neutral-700 dark:text-neutral-300 font-medium">
                    Student
                  </Label>
                </div>
              </RadioGroup>
              {errors.role && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="text-xs">⚠</span>
                  {errors.role.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="uniqueId" className="text-neutral-700 dark:text-neutral-300 font-medium">
                {selectedRole === "faculty" ? "Professor ID" : "Registration Number"}
              </Label>
              <Input
                id="uniqueId"
                placeholder={
                  selectedRole === "faculty" 
                    ? "Enter your professor ID" 
                    : "Enter your registration number"
                }
                {...register("uniqueId")}
                className={`h-11 input-field ${errors.uniqueId ? "border-red-300 focus:border-red-500 dark:border-red-500 dark:focus:border-red-400" : ""}`}
              />
              {errors.uniqueId && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="text-xs">⚠</span>
                  {errors.uniqueId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-700 dark:text-neutral-300 font-medium">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  {...register("password")}
                  className={`h-11 input-field pr-10 ${errors.password ? "border-red-300 focus:border-red-500 dark:border-red-500 dark:focus:border-red-400" : ""}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  )}
                </Button>
              </div>
              
              {/* Password Requirements */}
              {passwordValue && (
                <div className="space-y-2 p-3 bg-white/40 dark:bg-slate-800/40 rounded-lg border border-neutral-200 dark:border-slate-600">
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Password Requirements:</p>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    <div className={`flex items-center gap-2 ${requirements.minLength ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {requirements.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-2 ${requirements.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {requirements.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      One lowercase letter (a-z)
                    </div>
                    <div className={`flex items-center gap-2 ${requirements.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {requirements.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      One uppercase letter (A-Z)
                    </div>
                    <div className={`flex items-center gap-2 ${requirements.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {requirements.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      One number (0-9)
                    </div>
                    <div className={`flex items-center gap-2 ${requirements.hasSpecialChar ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {requirements.hasSpecialChar ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      One special character (@#$%^&*!+=?)
                    </div>
                    <div className={`flex items-center gap-2 ${requirements.noForbiddenChars ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {requirements.noForbiddenChars ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      No underscores (_) or hyphens (-)
                    </div>
                  </div>
                </div>
              )}
              
              {errors.password && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="text-xs">⚠</span>
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-neutral-700 dark:text-neutral-300 font-medium">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  {...register("confirmPassword")}
                  className={`h-11 input-field pr-10 ${errors.confirmPassword ? "border-red-300 focus:border-red-500 dark:border-red-500 dark:focus:border-red-400" : ""}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  )}
                </Button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <span className="text-xs">⚠</span>
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full h-12 btn-primary text-white font-medium text-base mt-8" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>

          <div className="mt-8 text-center space-y-3">
            <p className="text-sm text-neutral-600">
              Already have an account?{" "}
              <Link 
                to="/login" 
                className="text-brand-600 hover:text-brand-700 underline font-medium transition-colors"
              >
                Sign in here
              </Link>
            </p>
            <Link 
              to="/" 
              className="text-sm text-neutral-500 hover:text-neutral-700 inline-flex items-center gap-1 transition-colors"
            >
              <span>←</span>
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;