import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Users, QrCode, BarChart, User, LogIn, UserPlus } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Enhanced Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-xl shadow-lg shadow-blue-500/10 dark:border-slate-700/20 dark:bg-slate-900/80 dark:shadow-slate-900/20">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                <img src="/LOGO.png" alt="QAttend Logo" className="relative h-8 w-8 sm:h-12 sm:w-12 rounded-xl shadow-lg" />
              </div>
              <div>
                <h1 className="text-lg sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  QAttend
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">Smart Attendance Solution</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-blue-200 hover:border-blue-300 hover:bg-blue-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800 transition-all duration-200">
                    <User className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Account</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>
                    <p className="text-sm font-medium">Get Started</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/login')} className="cursor-pointer">
                    <LogIn className="mr-2 h-4 w-4" />
                    <span>Login</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/register')} className="cursor-pointer">
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Register</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Enhanced Hero Section */}
      <main className="container mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <div className="text-center max-w-6xl mx-auto">
          <div className="relative mb-6 sm:mb-8">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-800 dark:text-slate-100 mb-4 sm:mb-6 leading-tight px-2 sm:px-0">
              Automated Student{" "}
              <span className="relative">
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Attendance System
                </span>
                <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full opacity-30"></div>
              </span>
            </h2>
          </div>
          <p className="text-lg sm:text-xl md:text-2xl text-slate-600 dark:text-slate-300 mb-12 sm:mb-16 leading-relaxed max-w-4xl mx-auto px-2 sm:px-0">
            Streamline attendance tracking with cutting-edge QR code technology. 
            <br className="hidden sm:block" />
            Perfect for modern educational institutions.
          </p>

          {/* Enhanced Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 md:gap-10 mb-16 sm:mb-20 px-4 sm:px-0">
            <div className="group bg-white/80 backdrop-blur-sm border border-white/50 p-6 sm:p-8 rounded-2xl hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 transform hover:-translate-y-2 dark:bg-slate-800/80 dark:border-slate-700/50">
              <div className="relative mb-6 sm:mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <QrCode className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-800 dark:text-slate-100">QR Code Scanning</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base sm:text-lg">
                Lightning-fast attendance marking with secure, dynamic QR codes that refresh automatically
              </p>
            </div>
            <div className="group bg-white/80 backdrop-blur-sm border border-white/50 p-6 sm:p-8 rounded-2xl hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 transform hover:-translate-y-2 dark:bg-slate-800/80 dark:border-slate-700/50">
              <div className="relative mb-6 sm:mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <Users className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-800 dark:text-slate-100">Real-time Tracking</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base sm:text-lg">
                Monitor attendance instantly with live updates and comprehensive student management
              </p>
            </div>
            <div className="group bg-white/80 backdrop-blur-sm border border-white/50 p-6 sm:p-8 rounded-2xl hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-2 dark:bg-slate-800/80 dark:border-slate-700/50">
              <div className="relative mb-6 sm:mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <BarChart className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-slate-800 dark:text-slate-100">Analytics Dashboard</h3>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base sm:text-lg">
                Generate detailed reports and insights with powerful analytics and PDF exports
              </p>
            </div>
          </div>

          {/* Enhanced CTA Section */}
          <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-8 sm:p-12 rounded-3xl shadow-2xl overflow-hidden mx-4 sm:mx-0">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full bg-white/5 backdrop-blur-sm"></div>
              <div className="absolute top-4 right-4 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
              <div className="absolute bottom-4 left-4 w-24 h-24 bg-white/10 rounded-full blur-lg"></div>
            </div>
            
            <div className="relative z-10 text-center text-white">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">Ready to Transform Your Classroom?</h3>
              <p className="text-base sm:text-lg md:text-xl mb-8 sm:mb-10 leading-relaxed opacity-90 max-w-2xl mx-auto px-2 sm:px-0">
                Join thousands of educators already using QAttend to streamline their attendance management and focus on what matters most - teaching.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
                <Button 
                  size="lg" 
                  onClick={() => navigate('/register')} 
                  className="bg-white text-blue-600 hover:bg-gray-100 text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 w-full sm:w-auto"
                >
                  Create Account
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={() => navigate('/login')} 
                  className="border-white border-2 text-white bg-white/20 hover:bg-white/30 backdrop-blur-sm text-base sm:text-lg px-8 sm:px-10 py-3 sm:py-4 font-semibold transition-all duration-200 shadow-lg w-full sm:w-auto"
                >
                  Sign In
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Enhanced Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 mt-16 sm:mt-24">
        <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <img src="/LOGO.png" alt="QAttend Logo" className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg" />
              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                QAttend
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-2 text-sm sm:text-base">Smart Attendance Solution for Modern Education</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">&copy; 2025 QAttend. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;