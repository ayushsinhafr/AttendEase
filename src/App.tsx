import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider } from "./hooks/useTheme";
import { useEffect } from "react";
import { modelPreloader } from "./lib/face/modelPreloader";
import { ModelPreloadIndicator } from "./components/ModelPreloadIndicator";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPasswordVerify from "./pages/ResetPasswordVerify";
import Dashboard from "./pages/Dashboard";
import FaceEnrollment from "./pages/FaceEnrollment";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Component to handle auth-based routing
const AuthenticatedApp = () => {
  const { user, loading, profile } = useAuth();
  
  // Start preloading models when app loads
  useEffect(() => {
    // Start preloading in background (don't await - let it run async)
    modelPreloader.startPreloading().catch(error => {
      console.warn('Model preloading failed:', error);
    });
  }, []);
  
  if (loading) {
    return <div>Loading...</div>;
  }

  // Check if user exists but has no profile (needs verification)
  const needsVerification = user && !profile;

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          needsVerification ? 
            <Navigate to={`/verify-email?email=${encodeURIComponent(user.email || '')}&type=signup`} replace /> :
            user ? <Navigate to="/dashboard" replace /> : <Landing />
        } 
      />
      <Route 
        path="/login" 
        element={
          needsVerification ? 
            <Navigate to={`/verify-email?email=${encodeURIComponent(user.email || '')}&type=signup`} replace /> :
            user ? <Navigate to="/dashboard" replace /> : <Login />
        } 
      />
      <Route 
        path="/register" 
        element={
          needsVerification ? 
            <Navigate to={`/verify-email?email=${encodeURIComponent(user.email || '')}&type=signup`} replace /> :
            user ? <Navigate to="/dashboard" replace /> : <Register />
        } 
      />
      <Route 
        path="/verify-email" 
        element={<VerifyEmail />} 
      />
      <Route 
        path="/forgot-password" 
        element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} 
      />
      <Route 
        path="/reset-password-verify" 
        element={<ResetPasswordVerify />} 
      />
      <Route
        path="/dashboard"
        element={
          needsVerification ? (
            <Navigate to={`/verify-email?email=${encodeURIComponent(user?.email || '')}&type=signup`} replace />
          ) : (
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          )
        }
      />
      <Route
        path="/face-enrollment"
        element={<FaceEnrollment />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="qattend-ui-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <AuthenticatedApp />
            <ModelPreloadIndicator />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
