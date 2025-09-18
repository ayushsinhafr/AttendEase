import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, LogOut, AlertTriangle } from "lucide-react";
import FacultyDashboard from "./FacultyDashboard";
import StudentDashboard from "./StudentDashboard";

const Dashboard = () => {
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
      // Force navigation to home page even if signOut fails
      window.location.href = '/';
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  // Route to appropriate dashboard based on role
  if (profile.role === 'faculty') {
    return <FacultyDashboard />;
  } else if (profile.role === 'student') {
    return <StudentDashboard />;
  }

  // Fallback for unknown roles
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100/50">
      <header className="border-b border-brand-100 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gradient">QAttend</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <p className="font-medium text-neutral-800">{profile.name}</p>
                <p className="text-neutral-600 capitalize">{profile.role}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSignOut}
                className="border-brand-200 text-brand-700 hover:bg-brand-50 hover:text-brand-800"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="glass-card border-0 shadow-lg">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl text-neutral-800">Welcome, {profile.name}!</CardTitle>
              <CardDescription className="text-neutral-600">
                Your role: <span className="capitalize font-medium text-brand-600">{profile.role}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-6 bg-gradient-to-r from-brand-50 to-neutral-50 rounded-xl border border-brand-100">
                <h3 className="font-semibold mb-4 text-neutral-800 flex items-center gap-2">
                  <div className="w-2 h-2 bg-brand-500 rounded-full"></div>
                  Account Information
                </h3>
                <div className="text-sm space-y-3">
                  <div className="flex justify-between">
                    <span className="font-medium text-neutral-700">Name:</span>
                    <span className="text-neutral-800">{profile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-neutral-700">Role:</span>
                    <span className="capitalize text-brand-600 font-medium">{profile.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-neutral-700">ID:</span>
                    <span className="text-neutral-800 font-mono">{profile.unique_id}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-center py-8 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
                <p className="text-neutral-700 mb-2 font-medium">
                  Unable to load dashboard for role: {profile.role}
                </p>
                <p className="text-sm text-neutral-600">
                  Please contact support if this issue persists.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;