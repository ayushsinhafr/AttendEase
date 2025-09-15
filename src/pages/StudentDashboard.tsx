import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClasses } from "@/hooks/useClasses";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, LogOut, Plus, QrCode, Camera, BookOpen, Calendar, AlertTriangle, Clock, CheckCircle, User, BarChart3, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import QrScanner from "qr-scanner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const StudentDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const { enrollments, loading, joinClass, markAttendance } = useClasses();
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [selectedAnalyticsClass, setSelectedAnalyticsClass] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [attendancePercentages, setAttendancePercentages] = useState<{[key: string]: number}>({});
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [lastScannedQR, setLastScannedQR] = useState<string>("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  // Check if we're in a secure context
  const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await joinClass(classCode);
    if (success) {
      setClassCode("");
      setShowJoinClass(false);
    }
  };

  const fetchAttendanceHistory = async (classId: string) => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*, timestamp, session_date')
        .eq('student_id', user?.id)
        .eq('class_id', classId)
        .order('session_date', { ascending: false });

      if (error) throw error;
      console.log('Attendance data:', data); // Debug log
      setAttendanceHistory(data || []);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      setAttendanceHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const calculateAttendancePercentage = async (classId: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('status, session_date')
        .eq('student_id', user?.id)
        .eq('class_id', classId);

      if (error) throw error;

      if (!data || data.length === 0) {
        return 0;
      }

      const presentCount = data.filter(record => record.status === 'present').length;
      const totalSessions = data.length;
      
      return Math.round((presentCount / totalSessions) * 100);
    } catch (error) {
      console.error('Error calculating attendance percentage:', error);
      return 0;
    }
  };

  const loadAttendancePercentages = async () => {
    if (!user?.id || !enrollments) return;

    const percentages: {[key: string]: number} = {};
    
    for (const enrollment of enrollments) {
      const percentage = await calculateAttendancePercentage(enrollment.classes.id);
      percentages[enrollment.classes.id] = percentage;
    }
    
    setAttendancePercentages(percentages);
  };

  // Load attendance percentages when enrollments change
  useEffect(() => {
    loadAttendancePercentages();
  }, [enrollments, user?.id]);

  const handleViewHistory = (classInfo: any) => {
    setSelectedClass(classInfo);
    setShowHistory(true);
    fetchAttendanceHistory(classInfo.id);
  };

  const fetchStudentAnalytics = async (classInfo: any) => {
    setAnalyticsLoading(true);
    try {
      // Fetch all attendance records for this student in this class
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user?.id)
        .eq('class_id', classInfo.id)
        .order('session_date', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Get unique sessions based on timestamp
      const uniqueSessionTimestamps = [...new Set((attendanceRecords || []).map(r => r.timestamp))];
      const totalSessions = uniqueSessionTimestamps.length;
      
      // Count present sessions
      const presentSessions = (attendanceRecords || []).filter(r => r.status === 'present').length;
      const absentSessions = totalSessions - presentSessions;
      
      // Calculate percentage
      const attendancePercentage = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;

      // Group by session date for the chart
      const sessionsByDate = (attendanceRecords || []).reduce((acc: any, record) => {
        const dateKey = record.session_date;
        if (!acc[dateKey]) {
          acc[dateKey] = { date: dateKey, status: record.status };
        }
        return acc;
      }, {});

      const chartData = Object.values(sessionsByDate).map((session: any) => ({
        date: new Date(session.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }),
        present: session.status === 'present' ? 1 : 0,
        absent: session.status === 'absent' ? 1 : 0
      }));

      // Create pie chart data
      const pieChartData = [
        { name: 'Present', value: presentSessions, color: '#10B981' },
        { name: 'Absent', value: absentSessions, color: '#EF4444' }
      ].filter(item => item.value > 0);

      setAnalyticsData({
        classInfo,
        totalSessions,
        presentSessions,
        absentSessions,
        attendancePercentage,
        chartData,
        pieChartData,
        attendanceHistory: attendanceRecords || []
      });
    } catch (err) {
      console.error('Error fetching student analytics:', err);
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleViewAnalytics = (classInfo: any) => {
    setSelectedAnalyticsClass(classInfo);
    setShowAnalytics(true);
    fetchStudentAnalytics(classInfo);
  };

  const startScanner = useCallback(async () => {
    if (!videoRef.current) {
      console.error('Video element not found');
      setCameraError("Camera element not ready. Please try again.");
      return;
    }

    try {
      setCameraError("");
      setIsScanning(true);
      console.log('Starting camera scanner...');

      // Set a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        setIsScanning(false);
        setCameraError("Camera initialization timed out. Please try again.");
      }, 15000); // 15 second timeout

      // First, ensure QR Scanner has camera capabilities
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        clearTimeout(timeoutId);
        throw new Error("No camera found on this device");
      }

      // Create scanner BEFORE requesting camera permission
      const scanner = new QrScanner(
        videoRef.current,
        async (result) => {
          console.log('QR Code scanned:', result.data);
          
          // Prevent multiple scans of the same QR code
          if (isProcessingQR || result.data === lastScannedQR) {
            console.log('Ignoring duplicate QR scan');
            return;
          }
          
          setIsProcessingQR(true);
          setLastScannedQR(result.data);
          
          try {
            const success = await markAttendance(result.data);
            if (success) {
              stopScanner();
              // Refresh attendance percentage after marking attendance
              if (selectedClass) {
                const newPercentage = await calculateAttendancePercentage(selectedClass.id);
                setAttendancePercentages(prev => ({
                  ...prev,
                  [selectedClass.id]: newPercentage
                }));
              }
            }
          } finally {
            // Reset processing state after a delay to allow for new scans
            setTimeout(() => {
              setIsProcessingQR(false);
              setLastScannedQR("");
            }, 3000); // 3 second cooldown
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
          preferredCamera: 'environment', // Try to use back camera on mobile
          maxScansPerSecond: 2, // Reduce scan frequency to prevent multiple triggers
        }
      );

      scannerRef.current = scanner;
      
      // Start the scanner (this will request camera permission)
      console.log('Starting QR scanner...');
      await scanner.start();
      console.log('QR scanner started successfully');
      
      // Ensure video is playing
      if (videoRef.current && videoRef.current.paused) {
        await videoRef.current.play();
      }
      
      // Clear timeout on success
      clearTimeout(timeoutId);
      
    } catch (error) {
      console.error('Error starting scanner:', error);
      setIsScanning(false);
      
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes("permission") || errorMessage.includes("notallowederror")) {
          setCameraError("Camera permission denied. Please allow camera access and try again.");
        } else if (errorMessage.includes("notfounderror") || errorMessage.includes("no camera")) {
          setCameraError("No camera found on this device.");
        } else if (errorMessage.includes("notreadableerror")) {
          setCameraError("Camera is already in use by another application.");
        } else if (errorMessage.includes("overconstrained")) {
          setCameraError("Camera constraints not supported on this device.");
        } else if (errorMessage.includes("notsupported")) {
          setCameraError("Camera not supported in this browser. Try Chrome or Firefox.");
        } else if (errorMessage.includes("secure context")) {
          setCameraError("Camera requires HTTPS. Try accessing via Chrome with --unsafely-treat-insecure-origin-as-secure flag.");
        } else {
          setCameraError(`Camera error: ${error.message}`);
        }
      } else {
        setCameraError("Failed to start camera. Please try again.");
      }
    }
  }, [markAttendance]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    
    // Stop any video streams
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setCameraError("");
    setSelectedClass(null);
    setIsProcessingQR(false);
    setLastScannedQR("");
  }, []);

  useEffect(() => {
    // Don't auto-start scanner when dialog opens
    // User must click "Start Camera" button
    
    return () => {
      // Cleanup when component unmounts or dialog closes
      if (scannerRef.current) {
        console.log('Cleaning up scanner on unmount/close');
        try {
          scannerRef.current.stop();
          scannerRef.current.destroy();
          scannerRef.current = null;
        } catch (error) {
          console.error('Error cleaning up scanner:', error);
        }
      }
      
      // Stop video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [showScanner]);

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
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Enhanced Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-xl shadow-lg shadow-emerald-500/10 dark:border-slate-700/20 dark:bg-slate-900/80 dark:shadow-slate-900/20">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl blur opacity-75"></div>
                <img src="/LOGO.png" alt="AttendEase Logo" className="relative h-8 w-8 sm:h-12 sm:w-12 rounded-xl shadow-lg" />
              </div>
              <div className="text-left">
                <h1 className="text-lg sm:text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                  AttendEase
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Student Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-slate-500 dark:hover:bg-slate-800 transition-all duration-200">
                    <User className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{profile.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{profile.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{profile.unique_id}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {/* Enhanced Actions Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-4 mb-8 sm:mb-12">
          <div className="w-full sm:w-auto text-center sm:text-left">
            <h2 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent dark:from-slate-200 dark:to-slate-400 mb-2">
              My Classes
            </h2>
            <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-400">Join classes and mark your attendance seamlessly</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
            <Dialog open={showJoinClass} onOpenChange={setShowJoinClass}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="lg"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 px-4 sm:px-6 py-3 transition-all duration-200 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-900/20 dark:hover:border-emerald-500 w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Join Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a Class</DialogTitle>
                  <DialogDescription>
                    Enter the class code provided by your teacher to join the class.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleJoinClass} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="classCode">Class Code</Label>
                    <Input
                      id="classCode"
                      placeholder="e.g., CS101-A, MATH-B-1"
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" className="flex-1">Join Class</Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowJoinClass(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={showScanner} onOpenChange={(open) => {
              if (!open) {
                // Dialog is closing, stop scanner
                stopScanner();
              }
              setShowScanner(open);
            }}>
              <DialogTrigger asChild>
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-4 sm:px-6 py-3 w-full sm:w-auto"
                >
                  <QrCode className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Scan QR Code
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Mark Attendance</DialogTitle>
                  <DialogDescription>
                    {selectedClass && (
                      <div className="mb-3 p-3 bg-primary/10 rounded-lg">
                        <div className="font-medium text-primary">
                          {selectedClass.class_name} - Section {selectedClass.section}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Class Code: <span className="font-mono">{selectedClass.class_code}</span>
                        </div>
                      </div>
                    )}
                    Point your camera at the QR code displayed by your teacher.
                    {!isSecureContext && (
                      <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
                        <div className="text-orange-800 font-medium text-sm mb-2">
                          ⚠️ Camera access may be blocked on HTTP
                        </div>
                        <div className="text-orange-700 text-xs space-y-1">
                          <p><strong>Options to fix this:</strong></p>
                          <p>1. Use HTTPS: <code className="bg-orange-100 px-1 rounded">npm run dev:https</code></p>
                          <p>2. Or start Chrome with: <code className="bg-orange-100 px-1 rounded">--unsafely-treat-insecure-origin-as-secure=http://localhost:8080</code></p>
                        </div>
                      </div>
                    )}
                  </DialogDescription>
                </DialogHeader>
                
                {/* Important Instructions */}
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Before scanning:</strong> Make sure your teacher has generated a QR code for <strong>{selectedClass?.class_name || 'this class'}</strong> and that you're in the right classroom. QR codes expire after 5 minutes.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                    <video 
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                      style={{ width: '100%', height: '100%' }}
                    />
                    {(!isScanning || cameraError) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                        <div className="text-center">
                          {cameraError ? (
                            <>
                              <Camera className="h-12 w-12 mx-auto mb-2 text-destructive" />
                              <p className="text-sm text-destructive mb-2">{cameraError}</p>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={() => {
                                  setCameraError("");
                                  startScanner();
                                }}
                              >
                                Try Again
                              </Button>
                            </>
                          ) : (
                            <>
                              <Camera className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground mb-4">Ready to scan</p>
                              <div className="space-y-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => {
                                    setCameraError("");
                                    startScanner();
                                  }}
                                >
                                  Start Camera
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                  Allow camera access when prompted
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Show scanning indicator when camera is active */}
                    {isScanning && !cameraError && (
                      <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                        📹 Scanning...
                      </div>
                    )}
                    
                    {/* Show processing indicator when QR is being processed */}
                    {isProcessingQR && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
                        ⏳ Processing...
                      </div>
                    )}
                  </div>
                  
                  {/* Help text */}
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Position the QR code within the camera view
                    </p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>• Make sure camera permission is allowed</p>
                      <p>• Ensure good lighting for better scanning</p>
                      <p>• Hold device steady when scanning</p>
                    </div>
                  </div>
                  
                  {/* Manual input fallback */}
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2 text-center">
                      Camera not working? Enter QR code manually:
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Paste QR code content here..."
                        className="flex-1"
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const target = e.target as HTMLInputElement;
                            const qrContent = target.value.trim();
                            if (qrContent) {
                              const success = await markAttendance(qrContent);
                              if (success) {
                                target.value = '';
                                setShowScanner(false);
                              }
                            }
                          }
                        }}
                      />
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const input = document.querySelector('input[placeholder="Paste QR code content here..."]') as HTMLInputElement;
                          const qrContent = input?.value.trim();
                          if (qrContent) {
                            const success = await markAttendance(qrContent);
                            if (success) {
                              input.value = '';
                              setShowScanner(false);
                            }
                          }
                        }}
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={stopScanner}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Attendance History Dialog */}
            <Dialog open={showHistory} onOpenChange={setShowHistory}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Attendance History
                  </DialogTitle>
                  <DialogDescription>
                    {selectedClass && (
                      <div className="mb-3 p-3 bg-primary/10 rounded-lg">
                        <div className="font-medium text-primary">
                          {selectedClass.class_name} - Section {selectedClass.section}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Class Code: <span className="font-mono">{selectedClass.class_code}</span>
                        </div>
                      </div>
                    )}
                    Your attendance record for this class.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {historyLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading history...</p>
                    </div>
                  ) : attendanceHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                      <h3 className="font-medium mb-1">No Attendance Records</h3>
                      <p className="text-sm text-muted-foreground">
                        You haven't marked attendance for this class yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attendanceHistory.map((record, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              record.status === 'present' ? 'bg-green-500' : 
                              record.status === 'absent' ? 'bg-red-500' : 'bg-yellow-500'
                            }`} />
                            <div>
                              <div className="font-medium text-sm">
                                {new Date(record.session_date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {record.timestamp ? (
                                  <>Marked at: {new Date(record.timestamp).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}</>
                                ) : (
                                  <>Time not available</>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {record.status === 'present' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-red-500" />
                            )}
                            <span className="text-sm font-medium capitalize">
                              {record.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setShowHistory(false)}>
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Student Analytics Dialog */}
            <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Attendance Analytics
                  </DialogTitle>
                  <DialogDescription>
                    {selectedAnalyticsClass && (
                      <div className="mb-3 p-3 bg-primary/10 rounded-lg">
                        <div className="font-medium text-primary">
                          {selectedAnalyticsClass.class_name} - Section {selectedAnalyticsClass.section}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Class Code: <span className="font-mono">{selectedAnalyticsClass.class_code}</span>
                        </div>
                      </div>
                    )}
                    Your detailed attendance statistics and trends.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {analyticsLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                      <p className="text-muted-foreground">Loading analytics...</p>
                    </div>
                  ) : !analyticsData ? (
                    <div className="text-center py-12">
                      <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">No Data Available</h3>
                      <p className="text-muted-foreground">
                        Unable to load analytics data for this class.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Statistics Overview */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 dark:from-emerald-900/20 dark:to-emerald-800/20 dark:border-emerald-700">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Total Sessions</p>
                                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                                  {analyticsData.totalSessions}
                                </p>
                              </div>
                              <Calendar className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 dark:border-blue-700">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Present</p>
                                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                  {analyticsData.presentSessions}
                                </p>
                              </div>
                              <CheckCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 dark:from-purple-900/20 dark:to-purple-800/20 dark:border-purple-700">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Attendance Rate</p>
                                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                                  {analyticsData.attendancePercentage}%
                                </p>
                              </div>
                              <TrendingUp className={`h-8 w-8 ${
                                analyticsData.attendancePercentage >= 75 ? 'text-green-600' : 
                                analyticsData.attendancePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                              }`} />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Charts Section */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Pie Chart */}
                        {analyticsData.pieChartData && analyticsData.pieChartData.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Attendance Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie
                                      data={analyticsData.pieChartData}
                                      cx="50%"
                                      cy="50%"
                                      outerRadius={80}
                                      fill="#8884d8"
                                      dataKey="value"
                                      label={({ name, value }: any) => {
                                        const total = analyticsData.pieChartData.reduce((sum: number, item: any) => sum + item.value, 0);
                                        const percent = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                                        return `${name} ${percent}%`;
                                      }}
                                    >
                                      {analyticsData.pieChartData.map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                      ))}
                                    </Pie>
                                    <Tooltip />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Bar Chart */}
                        {analyticsData.chartData && analyticsData.chartData.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Attendance by Date</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={analyticsData.chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                      dataKey="date" 
                                      fontSize={12}
                                      angle={-45}
                                      textAnchor="end"
                                      height={60}
                                    />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar 
                                      dataKey="present" 
                                      fill="#10B981" 
                                      name="Present"
                                      stackId="attendance"
                                    />
                                    <Bar 
                                      dataKey="absent" 
                                      fill="#EF4444" 
                                      name="Absent"
                                      stackId="attendance"
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>

                      {/* Recent Attendance */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Recent Attendance</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {analyticsData.attendanceHistory.slice(0, 10).map((record: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className={`w-3 h-3 rounded-full ${
                                    record.status === 'present' ? 'bg-green-500' : 'bg-red-500'
                                  }`} />
                                  <div>
                                    <div className="font-medium text-sm">
                                      {new Date(record.session_date).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                      })}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {record.status === 'present' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-red-500" />
                                  )}
                                  <span className="text-sm font-medium capitalize">
                                    {record.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setShowAnalytics(false)}>
                    Close
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Classes Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your classes...</p>
          </div>
        ) : enrollments.length === 0 ? (
          <Card className="text-center py-16 bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 shadow-xl">
            <CardContent>
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-full blur-2xl opacity-20 w-32 h-32 mx-auto"></div>
                <BookOpen className="relative h-20 w-20 mx-auto text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">No Classes Joined Yet</h3>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                Get the class code from your teacher and join your first class to start tracking attendance.
              </p>
              <Button 
                onClick={() => setShowJoinClass(true)}
                className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-3"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Join Your First Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {enrollments.map((enrollment) => (
              <Card 
                key={enrollment.id} 
                className="group hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm border border-white/50 overflow-hidden relative dark:bg-slate-800/80 dark:border-slate-700/50 dark:hover:shadow-emerald-400/10"
              >
                {/* Card Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-blue-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 dark:from-emerald-900/20 dark:to-blue-900/20"></div>
                
                <CardHeader className="relative z-10 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-blue-500"></div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{enrollment.classes.class_name}</h3>
                      </div>
                      <p className="text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full w-fit dark:text-slate-400 dark:bg-slate-700">
                        Section: {enrollment.classes.section}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="bg-gradient-to-r from-emerald-500 to-blue-600 p-0.5 rounded-lg">
                      <div className="bg-white rounded-md px-3 py-2 dark:bg-slate-800">
                        <span className="font-mono font-bold text-sm text-transparent bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text">
                          {enrollment.classes.class_code}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="space-y-4">
                    {/* Enhanced Attendance Percentage Display */}
                    <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 dark:from-slate-800 dark:to-slate-700 dark:border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Attendance Rate</span>
                        <span className={`text-2xl font-bold ${
                          (attendancePercentages[enrollment.classes.id] || 0) >= 75 
                            ? 'text-emerald-600' 
                            : (attendancePercentages[enrollment.classes.id] || 0) >= 50 
                            ? 'text-amber-600' 
                            : 'text-red-600'
                        }`}>
                          {attendancePercentages[enrollment.classes.id] || 0}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-slate-600">
                        <div 
                          className={`h-3 rounded-full transition-all duration-500 ${
                            (attendancePercentages[enrollment.classes.id] || 0) >= 75 
                              ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' 
                              : (attendancePercentages[enrollment.classes.id] || 0) >= 50 
                              ? 'bg-gradient-to-r from-amber-400 to-amber-600' 
                              : 'bg-gradient-to-r from-red-400 to-red-600'
                          }`}
                          style={{ width: `${attendancePercentages[enrollment.classes.id] || 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        setSelectedClass(enrollment.classes);
                        setShowScanner(true);
                      }}
                      className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      size="lg"
                    >
                      <QrCode className="h-5 w-5 mr-2" />
                      Mark Attendance
                    </Button>
                    
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all duration-200 dark:hover:bg-blue-900/20 dark:hover:border-blue-400 dark:border-slate-600"
                        onClick={() => handleViewHistory(enrollment.classes)}
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        View History
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-600 transition-all duration-200 dark:hover:bg-emerald-900/20 dark:hover:border-emerald-400 dark:border-slate-600"
                        onClick={() => handleViewAnalytics(enrollment.classes)}
                      >
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Analytics
                      </Button>
                    </div>
                    
                    <div className="text-xs text-muted-foreground text-center pt-2">
                      Joined on {new Date(enrollment.enrolled_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentDashboard;