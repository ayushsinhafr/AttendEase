import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClasses, AttendanceRecord } from "@/hooks/useClasses";
import { AttendanceSessionManager } from "@/lib/sessionManager";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GraduationCap, LogOut, Plus, QrCode, Users, BarChart, Eye, Clock, Copy, Check, TrendingUp, Trash2, Calendar, Download, UserCheck, Camera, Play, Menu, User, Shuffle, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { generateAttendancePDF, generateSessionSummaryPDF } from "@/lib/pdfGenerator";
import { ThemeToggle } from "@/components/ThemeToggle";

// Custom Calendar Component
interface CalendarComponentProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

const CalendarComponent: React.FC<CalendarComponentProps> = ({ selectedDate, onDateSelect }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // Get first day of month and number of days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Generate calendar days
  const calendarDays = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(prev.getMonth() - 1);
      } else {
        newMonth.setMonth(prev.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const isSameDay = (date1: Date | null, date2: Date | null): boolean => {
    if (!date1 || !date2) return false;
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isToday = (date: Date): boolean => {
    return isSameDay(date, today);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 p-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateMonth('prev')}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateMonth('next')}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => (
          <div key={index} className="aspect-square">
            {date ? (
              <Button
                variant={isSameDay(date, selectedDate) ? "default" : "ghost"}
                size="sm"
                onClick={() => onDateSelect(date)}
                className={`h-full w-full p-0 relative ${
                  isToday(date) 
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' 
                    : ''
                } ${
                  isSameDay(date, selectedDate)
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'hover:bg-muted'
                }`}
              >
                <span className="text-sm">
                  {date.getDate()}
                </span>
              </Button>
            ) : (
              <div className="h-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const FacultyDashboard = () => {
  const { profile, signOut } = useAuth();
  const { toast } = useToast();
  const { classes, loading, createClass, generateQRToken, getLiveAttendance, deleteClass, getAttendanceSessions, getSessionAttendance, fetchClassAttendance, debugDatabaseContents } = useClasses();
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showSessionDetailDialog, setShowSessionDetailDialog] = useState(false);
  const [showManualAttendance, setShowManualAttendance] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showAttendanceSession, setShowAttendanceSession] = useState(false);
  const [showHybridAttendance, setShowHybridAttendance] = useState(false);
  const [hybridQrCodeUrl, setHybridQrCodeUrl] = useState<string>("");
  const [hybridManualAttendanceData, setHybridManualAttendanceData] = useState<{[key: string]: 'present' | 'absent' | 'pending'}>({});
  const [hybridEnrolledStudents, setHybridEnrolledStudents] = useState<any[]>([]);
  const [hybridAttendanceRecords, setHybridAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingHybridStudents, setLoadingHybridStudents] = useState(false);
  const [hybridSessionId, setHybridSessionId] = useState<string | null>(null);
  const [hybridSessionTimestamp, setHybridSessionTimestamp] = useState<string | null>(null);
  const [submittingHybridAttendance, setSubmittingHybridAttendance] = useState(false);
  const [currentSessionClass, setCurrentSessionClass] = useState<any>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedAnalyticsClass, setSelectedAnalyticsClass] = useState<any>(null);
  const [selectedSessionClass, setSelectedSessionClass] = useState<any>(null);
  const [selectedManualAttendanceClass, setSelectedManualAttendanceClass] = useState<any>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [manualAttendanceData, setManualAttendanceData] = useState<{[key: string]: 'present' | 'absent'}>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submittingAttendance, setSubmittingAttendance] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [sessionDetailData, setSessionDetailData] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingSessionDetail, setLoadingSessionDetail] = useState(false);
  const [selectedSessionDate, setSelectedSessionDate] = useState<string | null>(null);
  const [selectedCalendarClass, setSelectedCalendarClass] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateSessions, setSelectedDateSessions] = useState<any[]>([]);
  const [loadingDateSessions, setLoadingDateSessions] = useState(false);
  const [copySuccess, setCopySuccess] = useState<{[key: string]: boolean}>({});
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [liveAttendance, setLiveAttendance] = useState<AttendanceRecord[]>([]);

  // Form states
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [studentStrength, setStudentStrength] = useState(30);

  // Refs for cleanup
  const hybridIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const qrRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Rate limiting refs
  const lastQRGenerationRef = useRef<number>(0);
  const lastSessionStartRef = useRef<number>(0);
  const lastSubmissionRef = useRef<number>(0);

  // Component cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Clear any active intervals
      if (hybridIntervalRef.current) {
        clearInterval(hybridIntervalRef.current);
        hybridIntervalRef.current = null;
      }
      
      if (qrRefreshIntervalRef.current) {
        clearInterval(qrRefreshIntervalRef.current);
        qrRefreshIntervalRef.current = null;
      }
      
      // End any active sessions
      AttendanceSessionManager.endAllSessions();
    };
  }, []);

  // Real-time updates for hybrid attendance with memory leak protection
  useEffect(() => {
    if (!showHybridAttendance || !currentSessionClass) {
      // Clear interval when hybrid attendance is closed
      if (hybridIntervalRef.current) {
        clearInterval(hybridIntervalRef.current);
        hybridIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval before setting new one
    if (hybridIntervalRef.current) {
      clearInterval(hybridIntervalRef.current);
    }

    hybridIntervalRef.current = setInterval(() => {
      if (isMountedRef.current && showHybridAttendance && currentSessionClass) {
        fetchHybridAttendanceRecords(currentSessionClass.id);
      }
    }, 5000); // Refresh every 5 seconds

    return () => {
      if (hybridIntervalRef.current) {
        clearInterval(hybridIntervalRef.current);
        hybridIntervalRef.current = null;
      }
    };
  }, [showHybridAttendance, currentSessionClass, hybridManualAttendanceData]);

  // Auto-refresh QR code every 4.5 minutes for hybrid attendance with memory leak protection
  useEffect(() => {
    if (!showHybridAttendance || !currentSessionClass) {
      // Clear interval when hybrid attendance is closed
      if (qrRefreshIntervalRef.current) {
        clearInterval(qrRefreshIntervalRef.current);
        qrRefreshIntervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval before setting new one
    if (qrRefreshIntervalRef.current) {
      clearInterval(qrRefreshIntervalRef.current);
    }

    qrRefreshIntervalRef.current = setInterval(() => {
      if (isMountedRef.current && showHybridAttendance && currentSessionClass) {
        handleHybridGenerateQR(currentSessionClass.id);
        toast({
          title: "QR Code Refreshed",
          description: "New QR code generated for continued attendance marking",
        });
      }
    }, 270000); // 4.5 minutes

    return () => {
      if (qrRefreshIntervalRef.current) {
        clearInterval(qrRefreshIntervalRef.current);
        qrRefreshIntervalRef.current = null;
      }
    };
  }, [showHybridAttendance, currentSessionClass]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const newClass = await createClass(className, section, studentStrength);
    if (newClass) {
      setClassName("");
      setSection("");
      setStudentStrength(30);
      setShowCreateClass(false);
    }
  };

  const handleStartAttendanceSession = (classInfo: any) => {
    // Rate limiting - prevent session start more than once every 2 seconds
    const now = Date.now();
    if (now - lastSessionStartRef.current < 2000) {
      toast({
        title: "Rate Limit",
        description: "Please wait before starting another session",
        variant: "destructive",
      });
      return;
    }
    lastSessionStartRef.current = now;

    // Input validation
    if (!classInfo || !classInfo.id) {
      toast({
        title: "Error",
        description: "Invalid class information",
        variant: "destructive",
      });
      return;
    }

    setCurrentSessionClass(classInfo);
    setShowAttendanceSession(true);
  };

  const handleGenerateQR = async (classId: string) => {
    // Rate limiting - prevent QR generation more than once every 3 seconds
    const now = Date.now();
    if (now - lastQRGenerationRef.current < 3000) {
      toast({
        title: "Rate Limit",
        description: "Please wait before generating another QR code",
        variant: "destructive",
      });
      return;
    }
    lastQRGenerationRef.current = now;

    // Input validation
    if (!classId || typeof classId !== 'string' || classId.trim() === '') {
      toast({
        title: "Error",
        description: "Invalid class ID",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingQR(true);
    try {
      const token = await generateQRToken(classId);
      if (token) {
        // Generate QR code image
        const qrUrl = await QRCode.toDataURL(token);
        setQrCodeUrl(qrUrl);
        setSelectedClass(classId);
        
        toast({
          title: "Success",
          description: "QR code generated successfully!",
        });
      } else {
        throw new Error('Failed to generate QR token');
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleManualAttendance = async (classInfo: any) => {
    setSelectedManualAttendanceClass(classInfo);
    setShowManualAttendance(true);
    await fetchEnrolledStudents(classInfo.id);
  };

  const handleHybridAttendance = async (classInfo: any) => {
    setCurrentSessionClass(classInfo);
    
    // Create new session using session manager
    const session = AttendanceSessionManager.createSession(classInfo.id, 'hybrid');
    setHybridSessionId(session.sessionId);
    setHybridSessionTimestamp(session.sessionTimestamp);
    
    console.log('🚀 Starting new hybrid session with SessionManager:', {
      sessionId: session.sessionId,
      sessionTimestamp: session.sessionTimestamp,
      classId: classInfo.id
    });
    
    // Reset all hybrid state for fresh session
    setHybridAttendanceRecords([]);
    setHybridManualAttendanceData({});
    setHybridEnrolledStudents([]);
    setHybridQrCodeUrl('');
    
    setShowHybridAttendance(true);
    await fetchHybridEnrolledStudents(classInfo.id);
    await handleHybridGenerateQR(classInfo.id);
  };

  const fetchEnrolledStudents = async (classId: string) => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          student_id,
          profiles!enrollments_student_id_fkey (
            name,
            unique_id
          )
        `)
        .eq('class_id', classId);

      if (error) throw error;
      
      const students = data || [];
      setEnrolledStudents(students);
      
      // Initialize attendance data with empty state
      const initialAttendanceData: {[key: string]: 'present' | 'absent'} = {};
      students.forEach(student => {
        initialAttendanceData[student.student_id] = 'present'; // Default to present
      });
      setManualAttendanceData(initialAttendanceData);
    } catch (error) {
      console.error('Error fetching enrolled students:', error);
      toast({
        title: "Error",
        description: "Failed to fetch enrolled students",
        variant: "destructive",
      });
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchHybridEnrolledStudents = async (classId: string) => {
    setLoadingHybridStudents(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          id,
          student_id,
          profiles!inner(
            name,
            unique_id
          )
        `)
        .eq('class_id', classId);

      if (error) throw error;

      const students = data.map(enrollment => ({
        student_id: enrollment.student_id,
        name: enrollment.profiles.name,
        unique_id: enrollment.profiles.unique_id,
        enrollment_id: enrollment.id
      }));

      setHybridEnrolledStudents(students);

      // Initialize hybrid attendance data with 'pending' state
      const initialHybridAttendanceData: {[key: string]: 'present' | 'absent' | 'pending'} = {};
      students.forEach(student => {
        initialHybridAttendanceData[student.student_id] = 'pending';
      });
      setHybridManualAttendanceData(initialHybridAttendanceData);

      // Don't fetch existing attendance - this is a fresh session
    } catch (error) {
      console.error('Error fetching hybrid enrolled students:', error);
      toast({
        title: "Error",
        description: "Failed to fetch enrolled students",
        variant: "destructive",
      });
    } finally {
      setLoadingHybridStudents(false);
    }
  };

  const handleHybridGenerateQR = async (classId: string) => {
    setIsGeneratingQR(true);
    try {
      // Get the current hybrid session
      const session = AttendanceSessionManager.getActiveSession(classId, 'hybrid');
      if (!session) {
        console.error('No active hybrid session found');
        return;
      }

      // Generate secure token using session manager
      const hybridToken = AttendanceSessionManager.generateSecureQRToken(session);
      
      // Update the class with the hybrid QR token
      const expiration = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      const { error } = await supabase
        .from('classes')
        .update({
          qr_token: hybridToken,
          qr_expiration: expiration.toISOString()
        })
        .eq('id', classId);

      if (error) throw error;
      
      console.log('🔄 Generated secure hybrid QR token:', {
        token: hybridToken.substring(0, 20) + '...', // Log only part for security
        sessionId: session.sessionId,
        expiration: expiration.toISOString()
      });
      
      // Generate QR code image
      const qrUrl = await QRCode.toDataURL(hybridToken);
      setHybridQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error generating hybrid QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate hybrid QR code",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const fetchHybridAttendanceRecords = async (classId: string) => {
    if (!hybridSessionId || !hybridSessionTimestamp) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get QR attendance records marked since this session started (to show real-time updates)
    const sessionStartTime = hybridSessionTimestamp;
    
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        profiles!inner(
          name,
          unique_id
        )
      `)
      .eq('class_id', classId)
      .eq('session_date', today)
      .eq('status', 'present')
      .gte('timestamp', sessionStartTime); // Only get records since session started

    if (error) {
      console.error('Error fetching hybrid attendance records:', error);
      return;
    }

    // Show QR scans that happened during this session
    const qrScans = (data || []).filter(record => {
      // Only show QR scans for students not manually marked in this session
      return !hybridManualAttendanceData[record.student_id] || 
             hybridManualAttendanceData[record.student_id] === 'pending';
    });

    console.log('📱 Updated QR scans in hybrid session:', qrScans.length);

    setHybridAttendanceRecords(qrScans.map(record => ({
      ...record,
      status: record.status as 'present' | 'absent'
    })));
  };

  const handleHybridAttendanceToggle = (studentId: string, status: 'present' | 'absent') => {
    setHybridManualAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSubmitHybridAttendance = async () => {
    // Rate limiting - prevent submission more than once every 5 seconds
    const now = Date.now();
    if (now - lastSubmissionRef.current < 5000) {
      toast({
        title: "Rate Limit",
        description: "Please wait before submitting again",
        variant: "destructive",
      });
      return;
    }

    if (!currentSessionClass || !hybridSessionId || !hybridSessionTimestamp) {
      toast({
        title: "Error",
        description: "Missing session information",
        variant: "destructive",
      });
      return;
    }

    lastSubmissionRef.current = now;
    setSubmittingHybridAttendance(true);
    try {
      // Get the active session
      const session = AttendanceSessionManager.getActiveSession(currentSessionClass.id, 'hybrid');
      if (!session) {
        console.error('No active hybrid session found');
        return;
      }

      console.log('📊 Submitting hybrid attendance with SessionManager:', { 
        sessionId: session.sessionId, 
        sessionTimestamp: session.sessionTimestamp,
        qrScanned: hybridAttendanceRecords.length,
        manualMarked: Object.values(hybridManualAttendanceData).filter(s => s !== 'pending').length
      });

      // Prepare student status pairs for batch processing
      const studentStatusPairs: { studentId: string; status: 'present' | 'absent' }[] = [];

      // Add QR-scanned students (already marked as present)
      hybridAttendanceRecords.forEach(record => {
        studentStatusPairs.push({
          studentId: record.student_id,
          status: 'present'
        });
      });

      // Add manually marked students (not already in QR list)
      Object.entries(hybridManualAttendanceData).forEach(([studentId, status]) => {
        if (status !== 'pending' && !hybridAttendanceRecords.find(record => record.student_id === studentId)) {
          studentStatusPairs.push({
            studentId: studentId,
            status: status as 'present' | 'absent'
          });
        }
      });

      // Mark remaining students as absent
      hybridEnrolledStudents.forEach(student => {
        const isAlreadyMarked = studentStatusPairs.find(s => s.studentId === student.student_id);
        if (!isAlreadyMarked) {
          studentStatusPairs.push({
            studentId: student.student_id,
            status: 'absent'
          });
        }
      });

      // Use session manager for batch processing with consistent timestamps
      const result = await AttendanceSessionManager.createBatchAttendanceRecords(
        studentStatusPairs,
        session
      );

      if (result.error) {
        throw new Error('Failed to create attendance records');
      }

      const presentCount = studentStatusPairs.filter(s => s.status === 'present').length;
      const qrCount = hybridAttendanceRecords.length;
      const manualCount = presentCount - qrCount;

      console.log('✅ Hybrid session completed successfully with SessionManager:', { 
        sessionId: session.sessionId,
        sessionTimestamp: session.sessionTimestamp,
        presentCount, 
        qrCount, 
        manualCount, 
        totalStudents: hybridEnrolledStudents.length,
        processedRecords: result.data?.length || 0
      });

      toast({
        title: "Success",
        description: `Hybrid session completed! ${presentCount}/${hybridEnrolledStudents.length} present (${qrCount} QR, ${manualCount} manual)`,
      });

      // End the session and reset hybrid state
      AttendanceSessionManager.endSession(session.sessionId);
      setShowHybridAttendance(false);
      setHybridQrCodeUrl('');
      setHybridManualAttendanceData({});
      setHybridEnrolledStudents([]);
      setHybridAttendanceRecords([]);
      setHybridSessionId(null);
      setHybridSessionTimestamp(null);
      
    } catch (error) {
      console.error('Error submitting hybrid attendance:', error);
      toast({
        title: "Error",
        description: "Failed to submit hybrid attendance",
        variant: "destructive",
      });
    } finally {
      setSubmittingHybridAttendance(false);
    }
  };

  const handleAttendanceToggle = (studentId: string, status: 'present' | 'absent') => {
    setManualAttendanceData(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSubmitManualAttendance = async () => {
    if (!selectedManualAttendanceClass) return;

    setSubmittingAttendance(true);
    try {
      // Create unique session timestamp for this manual attendance session
      const sessionTimestamp = new Date().toISOString();
      const currentDate = sessionTimestamp.split('T')[0]; // YYYY-MM-DD format
      
      console.log('Creating new manual attendance session:', sessionTimestamp);
      
      // Create attendance records with unique session timestamp
      const attendanceRecords = Object.entries(manualAttendanceData).map(([studentId, status]) => ({
        student_id: studentId,
        class_id: selectedManualAttendanceClass.id,
        status: status,
        session_date: currentDate,
        timestamp: sessionTimestamp
      }));

      // Insert attendance records one by one to handle potential conflicts
      for (const record of attendanceRecords) {
        const { error } = await supabase
          .from('attendance')
          .insert(record);

        if (error) {
          console.error('Error inserting attendance record:', error);
          
          // If it's a unique constraint violation, try updating the existing record
          if (error.code === '23505') {
            const { error: updateError } = await supabase
              .from('attendance')
              .update({
                status: record.status,
                timestamp: record.timestamp
              })
              .eq('student_id', record.student_id)
              .eq('class_id', record.class_id)
              .eq('session_date', record.session_date);
            
            if (updateError) {
              console.error('Error updating attendance record:', updateError);
              throw updateError;
            }
          } else {
            throw error;
          }
        }
      }

      toast({
        title: "Success",
        description: `Manual attendance session created with ${enrolledStudents.length} students marked`,
      });

      setShowManualAttendance(false);
      setSelectedManualAttendanceClass(null);
      setEnrolledStudents([]);
      setManualAttendanceData({});

    } catch (error) {
      console.error('Error submitting manual attendance:', error);
      toast({
        title: "Error",
        description: "Failed to submit attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingAttendance(false);
    }
  };

  const fetchAnalytics = async (classInfo: any) => {
    setAnalyticsLoading(true);
    try {
      // 1. Fetch enrollments (no embedded profile to avoid RLS join blockage)
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_id', classInfo.id);
      if (enrollmentError) throw enrollmentError;

      const totalStudents = enrollments?.length || 0;
      const studentIds = (enrollments || []).map(e => e.student_id);

      // 2. Fetch attendance records
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', classInfo.id)
        .order('timestamp', { ascending: false });
      if (attendanceError) throw attendanceError;

      // 3. Fetch profiles separately (expect RLS to block unless policy added)
      let profileMap: Record<string, { name: string; unique_id: string }> = {};
      if (studentIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('user_id, name, unique_id')
          .in('user_id', studentIds);
        if (!profileError) {
          (profileRows || []).forEach(p => {
            profileMap[p.user_id] = { name: p.name || 'Unknown', unique_id: p.unique_id || 'N/A' };
          });
        }
      }

      // 4. Build sessions aggregation
      const uniqueSessionTimestamps = [...new Set((attendanceRecords || []).map((r: any) => r.timestamp))];
      const totalSessions = uniqueSessionTimestamps.length;
      const attendanceBySession = (attendanceRecords || []).reduce((acc: any, record: any) => {
        const key = record.timestamp;
        if (!acc[key]) {
          acc[key] = {
            date: record.session_date,
            timestamp: record.timestamp,
            presentCount: 0,
            absentCount: 0,
            attendedStudents: new Set()
          };
        }
        acc[key].attendedStudents.add(record.student_id);
        if (record.status === 'present') acc[key].presentCount++; else if (record.status === 'absent') acc[key].absentCount++;
        return acc;
      }, {});
      const sessionData = Object.values(attendanceBySession).map((s: any) => ({
        date: s.date,
        timestamp: s.timestamp,
        presentCount: s.presentCount,
        absentCount: s.absentCount,
        totalStudents,
        markedStudents: s.attendedStudents.size,
        notMarkedCount: Math.max(0, totalStudents - s.attendedStudents.size),
        attendancePercentage: totalStudents > 0 ? Math.round((s.presentCount / totalStudents) * 100) : 0
      }));
      const sortedSessions = sessionData.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const latestSession = sortedSessions[0] || null;
      const pieChartData = latestSession ? [
        { name: 'Present', value: latestSession.presentCount, color: '#10B981' },
        { name: 'Absent', value: latestSession.absentCount, color: '#EF4444' },
        { name: 'Not Marked', value: latestSession.notMarkedCount, color: '#6B7280' }
      ].filter(i => i.value > 0) : [];

      const totalPossibleAttendances = totalStudents * totalSessions;
      const totalPresentAttendances = (attendanceRecords || []).filter((r: any) => r.status === 'present').length;
      const averageAttendance = totalPossibleAttendances > 0 ? Math.round((totalPresentAttendances / totalPossibleAttendances) * 100) : 0;

      // 5. Student performance list
      const studentAttendance = (enrollments || []).map(e => {
        const recs = (attendanceRecords || []).filter(r => r.student_id === e.student_id);
        const present = recs.filter(r => r.status === 'present').length;
        const pct = totalSessions > 0 ? (present / totalSessions) * 100 : 0;
        const profile = profileMap[e.student_id];
        return {
          student_id: e.student_id,
          student_name: profile?.name || 'Unknown Student',
          student_unique_id: profile?.unique_id || 'N/A',
          totalSessions,
          presentDays: present,
          attendancePercentage: pct
        };
      }).sort((a, b) => b.attendancePercentage - a.attendancePercentage);

      setAnalyticsData({
        classInfo,
        totalStudents,
        totalSessions,
        averageAttendance,
        attendanceByDate: sortedSessions,
        studentAttendance,
        pieChartData,
        latestSession
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleViewAnalytics = (classInfo: any) => {
    setSelectedAnalyticsClass(classInfo);
    setShowAnalytics(true);
    fetchAnalytics(classInfo);
  };

  // Handle copy class code
  const handleCopyCode = async (classCode: string, classId: string) => {
    try {
      await navigator.clipboard.writeText(classCode);
      setCopySuccess(prev => ({ ...prev, [classId]: true }));
      setTimeout(() => {
        setCopySuccess(prev => ({ ...prev, [classId]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  // Handle delete class
  const handleDeleteClass = async (classInfo: any) => {
    if (window.confirm(`Are you sure you want to delete "${classInfo.class_name}" (Section: ${classInfo.section})? This will permanently remove the class and all related attendance data.`)) {
      await deleteClass(classInfo.id);
    }
  };

  // Handle view calendar for sessions
  const handleViewCalendar = (classInfo: any) => {
    setSelectedCalendarClass(classInfo);
    setSelectedDate(null);
    setSelectedDateSessions([]);
    setShowCalendarDialog(true);
  };

  // Handle date selection from calendar
  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    setLoadingDateSessions(true);
    
    try {
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log('📅 Fetching sessions for date:', dateString, 'class:', selectedCalendarClass.id);
      
      // Fetch sessions for the specific date
      const sessions = await getAttendanceSessions(selectedCalendarClass.id);
      console.log('🔍 All sessions received:', sessions);
      
      // Enhanced filtering with multiple date field checks
      const filteredSessions = sessions.filter((session: any) => {
        // Check multiple possible date fields
        let sessionDateString = '';
        
        if (session.session_date) {
          sessionDateString = new Date(session.session_date).toISOString().split('T')[0];
        } else if (session.timestamp) {
          sessionDateString = new Date(session.timestamp).toISOString().split('T')[0];
        } else if (session.session_time) {
          sessionDateString = new Date(session.session_time).toISOString().split('T')[0];
        } else if (session.created_at) {
          sessionDateString = new Date(session.created_at).toISOString().split('T')[0];
        }
        
        console.log('� Session:', session);
        console.log('🔍 Session date string:', sessionDateString, 'vs target:', dateString);
        
        return sessionDateString === dateString;
      });
      
      // Method 2: Also try direct attendance query as fallback
      let alternativeSessions: any[] = [];
      try {
        console.log('� Trying direct attendance query for date:', dateString);
        const { data: attendanceData, error } = await supabase
          .from('attendance')
          .select('*, timestamp, session_date, marked_at')
          .eq('class_id', selectedCalendarClass.id)
          .eq('session_date', dateString);
        
        if (!error && attendanceData && attendanceData.length > 0) {
          console.log('🔍 Direct attendance data:', attendanceData);
          
          // Group by timestamp to create session-like objects
          const groupedByTimestamp = attendanceData.reduce((acc: any, record: any) => {
            const timestamp = record.timestamp;
            if (!acc[timestamp]) {
              acc[timestamp] = {
                id: timestamp,
                timestamp: timestamp,
                session_date: record.session_date,
                session_time: record.timestamp,
                present_count: 0,
                absent_count: 0,
                attendanceRecords: []
              };
            }
            acc[timestamp].attendanceRecords.push(record);
            if (record.status === 'present') acc[timestamp].present_count++;
            if (record.status === 'absent') acc[timestamp].absent_count++;
            return acc;
          }, {});
          
          alternativeSessions = Object.values(groupedByTimestamp);
          console.log('🔍 Alternative sessions from attendance:', alternativeSessions);
        }
      } catch (altError) {
        console.log('🔍 Alternative query failed:', altError);
      }
      
      // Use whichever method found sessions
      const finalSessions = filteredSessions.length > 0 ? filteredSessions : alternativeSessions;
      
      console.log('📋 Final sessions for date:', finalSessions);
      setSelectedDateSessions(finalSessions);
    } catch (error) {
      console.error('❌ Error fetching sessions for date:', error);
      setSelectedDateSessions([]);
    } finally {
      setLoadingDateSessions(false);
    }
  };

  // Handle view attendance sessions (original functionality, now disabled)
  const handleViewSessions = async (classInfo: any) => {
    console.log('🎯 [handleViewSessions] Starting with class:', classInfo);
    
    setSelectedSessionClass(classInfo);
    setShowSessionsDialog(true);
    setLoadingSessions(true);
    
    try {
      console.log('📞 [handleViewSessions] Calling getAttendanceSessions...');
      const sessions = await getAttendanceSessions(classInfo.id);
      console.log('📋 [handleViewSessions] Received sessions:', sessions);
      
      setAttendanceSessions(sessions);
      console.log('✅ [handleViewSessions] Sessions set in state');
    } catch (error) {
      console.error('❌ [handleViewSessions] Error fetching sessions:', error);
      setAttendanceSessions([]);
    } finally {
      setLoadingSessions(false);
      console.log('🏁 [handleViewSessions] Finished loading');
    }
  };

  // Handle view session detail from calendar
  const handleCalendarSessionDetail = async (session: any) => {
    console.log('📅 [handleCalendarSessionDetail] Starting with session:', session);
    console.log('📅 [handleCalendarSessionDetail] Calendar class:', selectedCalendarClass);
    console.log('📅 [handleCalendarSessionDetail] Selected date:', selectedDate);
    
    // Set the selected session class to the calendar class for context
    setSelectedSessionClass(selectedCalendarClass);
    
    // Use session ID if available, otherwise use timestamp
    const sessionId = session.id || session.timestamp;
    const sessionTimestamp = session.timestamp || session.session_time;
    
    console.log('📅 [handleCalendarSessionDetail] Using:', { sessionId, sessionTimestamp });
    console.log('📅 [handleCalendarSessionDetail] Session object keys:', Object.keys(session));
    console.log('📅 [handleCalendarSessionDetail] Session values:', Object.values(session));
    
    setSelectedSessionDate(sessionTimestamp);
    setShowSessionDetailDialog(true);
    setLoadingSessionDetail(true);
    
    try {
      console.log('📞 [handleCalendarSessionDetail] Calling getSessionAttendance with class ID:', selectedCalendarClass.id);
      console.log('📞 [handleCalendarSessionDetail] Calling getSessionAttendance with timestamp:', sessionTimestamp);
      
      const detail = await getSessionAttendance(selectedCalendarClass.id, sessionTimestamp);
      console.log('📊 [handleCalendarSessionDetail] Received detail:', detail);
      console.log('📊 [handleCalendarSessionDetail] Detail length:', detail?.length || 0);
      
      if (detail && detail.length > 0) {
        console.log('📊 [handleCalendarSessionDetail] First student sample:', detail[0]);
      }
      
      setSessionDetailData(detail);
      console.log('✅ [handleCalendarSessionDetail] Detail set in state');
    } catch (error) {
      console.error('❌ [handleCalendarSessionDetail] Error fetching session detail:', error);
      setSessionDetailData([]);
    } finally {
      setLoadingSessionDetail(false);
      console.log('🏁 [handleCalendarSessionDetail] Finished loading');
    }
  };

  // Handle PDF download from calendar
  const handleCalendarPDFDownload = async (session: any) => {
    console.log('📄 [handleCalendarPDFDownload] Starting PDF generation for session:', session);
    
    try {
      // Fetch attendance data for this specific session
      const sessionTimestamp = session.timestamp || session.session_time;
      console.log('📄 [handleCalendarPDFDownload] Fetching attendance for timestamp:', sessionTimestamp);
      
      const attendanceData = await getSessionAttendance(selectedCalendarClass.id, sessionTimestamp);
      console.log('📄 [handleCalendarPDFDownload] Got attendance data:', attendanceData);
      
      // Prepare session date - use the actual session date, not selected date
      const sessionDate = session.session_date || selectedDate?.toISOString().split('T')[0] || '';
      const sessionTime = sessionTimestamp ? new Date(sessionTimestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }) : '';
      
      // Generate PDF with the fetched data
      const pdfData = {
        classInfo: {
          ...selectedCalendarClass,
          session_time: sessionTime // Add session time to class info
        },
        sessionDate: sessionDate,
        attendanceData: attendanceData || []
      };
      
      console.log('📄 [handleCalendarPDFDownload] Generating PDF with data:', pdfData);
      console.log('📄 [handleCalendarPDFDownload] Attendance data length:', attendanceData?.length || 0);
      
      generateSessionSummaryPDF(pdfData);
      
      toast({
        title: "PDF Generated",
        description: `Session attendance PDF downloaded with ${attendanceData?.length || 0} student records.`,
      });
      
    } catch (error) {
      console.error('❌ [handleCalendarPDFDownload] Error generating PDF:', error);
      toast({
        title: "PDF Generation Failed",
        description: "There was an error generating the PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle view session detail
  const handleViewSessionDetail = async (sessionId: string, sessionTimestamp: string) => {
    console.log('🔍 [handleViewSessionDetail] Starting with:', { sessionId, sessionTimestamp, selectedSessionClass });
    
    setSelectedSessionDate(sessionTimestamp);
    setShowSessionDetailDialog(true);
    setLoadingSessionDetail(true);
    
    try {
      console.log('📞 [handleViewSessionDetail] Calling getSessionAttendance...');
      const detail = await getSessionAttendance(selectedSessionClass.id, sessionTimestamp);
      console.log('📊 [handleViewSessionDetail] Received detail:', detail);
      
      setSessionDetailData(detail);
      console.log('✅ [handleViewSessionDetail] Detail set in state');
    } catch (error) {
      console.error('❌ [handleViewSessionDetail] Error fetching session detail:', error);
      setSessionDetailData([]);
    } finally {
      setLoadingSessionDetail(false);
      console.log('🏁 [handleViewSessionDetail] Finished loading');
    }
  };

  // Handle PDF download for attendance session
  const handleDownloadPDF = (type: 'detailed' | 'summary') => {
    if (!selectedSessionClass || !selectedSessionDate || !sessionDetailData.length) {
      console.error('Missing required data for PDF generation');
      return;
    }

    try {
      const sessionData = {
        classInfo: {
          class_name: selectedSessionClass.class_name,
          section: selectedSessionClass.section,
          class_code: selectedSessionClass.class_code,
          student_strength: selectedSessionClass.student_strength
        },
        sessionDate: selectedSessionDate,
        attendanceData: sessionDetailData as any[] // Cast to avoid type issues
      };

      if (type === 'detailed') {
        generateAttendancePDF(sessionData);
      } else {
        generateSessionSummaryPDF(sessionData);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      // You could show a toast notification here
    }
  };

  // Handle PDF download directly from sessions list
  const handleDownloadFromSessionsList = async (sessionTimestamp: string, type: 'detailed' | 'summary') => {
    if (!selectedSessionClass) {
      console.error('No class selected');
      return;
    }

    try {
      // Fetch session data
      const detail = await getSessionAttendance(selectedSessionClass.id, sessionTimestamp);
      
      const sessionData = {
        classInfo: {
          class_name: selectedSessionClass.class_name,
          section: selectedSessionClass.section,
          class_code: selectedSessionClass.class_code,
          student_strength: selectedSessionClass.student_strength
        },
        sessionDate: sessionTimestamp,
        attendanceData: detail as any[] // Cast to avoid type issues
      };

      if (type === 'detailed') {
        generateAttendancePDF(sessionData);
      } else {
        generateSessionSummaryPDF(sessionData);
      }
    } catch (error) {
      console.error('Error generating PDF from sessions list:', error);
      // You could show a toast notification here
    }
  };

  // Set up real-time listening for attendance updates
  useEffect(() => {
    if (!selectedClass) return;

    const channel = supabase
      .channel('attendance-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance',
          filter: `class_id=eq.${selectedClass}`
        },
        async (payload) => {
          // Fetch the student profile for the new attendance record
          const { data: studentData } = await supabase
            .from('profiles')
            .select('name, unique_id')
            .eq('user_id', payload.new.student_id)
            .maybeSingle();

          if (studentData) {
            const newRecord: AttendanceRecord = {
              ...payload.new as AttendanceRecord,
              profiles: studentData
            };
            setLiveAttendance(prev => [newRecord, ...prev]);
          }
        }
      )
      .subscribe();

    // Fetch today's attendance when class changes
    const fetchTodayAttendance = async () => {
      if (!selectedClass) return;
      const today = new Date().toISOString().split('T')[0];
      try {
        const records = await fetchClassAttendance(selectedClass);
        const todayRecords = records.filter(r => r.session_date === today);
        setLiveAttendance(todayRecords);
      } catch (err) {
        setLiveAttendance([]);
      }
    };
    fetchTodayAttendance();

    // Listen for attendanceMarked event to refresh live attendance
    const handler = (e: CustomEvent) => {
      if (e.detail.classId === selectedClass) {
        fetchTodayAttendance();
      }
    };
    window.addEventListener('attendanceMarked', handler);
    return () => {
      window.removeEventListener('attendanceMarked', handler);
    };

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClass]);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Enhanced Header */}
      <header className="border-b border-white/20 bg-white/80 backdrop-blur-xl shadow-lg shadow-blue-500/10 dark:border-slate-700/20 dark:bg-slate-900/80 dark:shadow-slate-900/20">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-75"></div>
                <img src="/LOGO.png" alt="AttendEase Logo" className="relative h-8 w-8 sm:h-12 sm:w-12 rounded-xl shadow-lg" />
              </div>
              <div className="text-left">
                <h1 className="text-lg sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AttendEase
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Faculty Dashboard</p>
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
            <h2 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
              My Classes
            </h2>
            <p className="text-sm sm:text-lg text-slate-600">Manage your classes and track attendance seamlessly</p>
          </div>
          
          <Dialog open={showCreateClass} onOpenChange={setShowCreateClass}>
            <DialogTrigger asChild>
              <Button 
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-4 sm:px-8 py-3 w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Create Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
                <DialogDescription>
                  Enter the class details to create a new class and generate a unique class code.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="className">Class Name</Label>
                  <Input
                    id="className"
                    placeholder="e.g., Computer Science 101"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Input
                    id="section"
                    placeholder="e.g., A, B, Morning, Evening"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentStrength">Expected Student Strength</Label>
                  <Input
                    id="studentStrength"
                    type="number"
                    min="1"
                    value={studentStrength}
                    onChange={(e) => setStudentStrength(parseInt(e.target.value))}
                    required
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">Create Class</Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateClass(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Enhanced QR Code Display */}
        {qrCodeUrl && selectedClass && (
          <Card className="mb-12 border border-blue-200 shadow-2xl shadow-blue-500/20 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="text-center border-b border-blue-100 bg-white/50 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-3 text-3xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text mb-2">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl">
                  <QrCode className="h-8 w-8 text-white" />
                </div>
                Attendance QR Code
              </div>
              <CardDescription className="text-base">
                Students can scan this QR code to mark their attendance instantly. 
                <div className="flex items-center justify-center gap-2 mt-3 text-orange-600 bg-orange-50 px-4 py-2 rounded-xl font-medium">
                  <Clock className="h-5 w-5" />
                  Expires in 5 minutes - Scan quickly!
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              {/* Enhanced QR Code Display */}
              <div className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl blur-lg opacity-50"></div>
                <div className="relative bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl">
                  <img 
                    src={qrCodeUrl} 
                    alt="Attendance QR Code" 
                    className="w-64 h-64 mx-auto rounded-xl"
                  />
                </div>
              </div>
              
              {/* Live Attendance Display */}
              {liveAttendance.length > 0 && (
                <div className="mt-8 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200 dark:border-green-700 shadow-lg">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <h4 className="text-xl font-semibold text-green-700">Live Attendance</h4>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-3">
                    {liveAttendance.map((record) => (
                      <div 
                        key={record.id} 
                        className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 rounded-xl border border-green-200 transform hover:scale-105 transition-all duration-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="font-semibold text-green-800">{record.profiles?.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-green-600 font-medium">{record.profiles?.unique_id}</div>
                          <div className="text-xs text-green-500">
                            {new Date(record.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                variant="outline" 
                onClick={() => {
                  setQrCodeUrl("");
                  setSelectedClass(null);
                }}
                className="mt-8 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:border-red-300 dark:hover:border-red-700 px-8 py-3 text-base font-medium rounded-xl transition-all duration-200"
                size="lg"
              >
                Close QR Code
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Classes Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-xl opacity-20 w-16 h-16 mx-auto"></div>
              <div className="relative animate-spin h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto"></div>
            </div>
            <p className="text-xl font-medium text-slate-700">Loading your classes...</p>
            <p className="text-slate-500 mt-2">Please wait while we fetch your data</p>
          </div>
        ) : classes.length === 0 ? (
          <Card className="text-center py-16 bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 border border-gray-200 dark:border-slate-700 shadow-xl">
            <CardContent>
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full blur-2xl opacity-20 w-32 h-32 mx-auto"></div>
                <GraduationCap className="relative h-20 w-20 mx-auto text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-200">No Classes Created Yet</h3>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                Start by creating your first class to begin taking attendance and managing your students.
              </p>
              <Button 
                onClick={() => setShowCreateClass(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-3"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Class
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {classes.map((cls) => (
              <Card 
                key={cls.id} 
                className="group hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-sm border border-white/50 overflow-hidden relative"
              >
                {/* Card Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-purple-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <CardHeader className="relative z-10 pb-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-emerald-500"></div>
                        <span className="text-lg sm:text-xl font-bold text-slate-800 leading-tight">{cls.class_name}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full w-fit">
                        Section: {cls.section}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-xl self-start sm:self-auto">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-700">{cls.student_strength}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="mb-6">
                    <span className="text-xs text-slate-500 block mb-2 font-medium">Class Code (Share with students):</span>
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-0.5 rounded-lg">
                      <div className="bg-white rounded-md px-4 py-3">
                        <span className="font-mono font-bold text-lg text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                          {cls.class_code}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <Button
                      onClick={() => handleStartAttendanceSession(cls)}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                      size="lg"
                    >
                      <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      <span className="text-sm sm:text-base">Start Attendance Session</span>
                    </Button>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleCopyCode(cls.class_code, cls.id)}
                        className="flex items-center justify-center hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all duration-200"
                      >
                        {copySuccess[cls.id] ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewCalendar(cls)}
                        className="flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition-all duration-200"
                      >
                        <Calendar className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDeleteClass(cls)}
                        className="flex items-center justify-center hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600 transition-all duration-200"
                      onClick={() => handleViewAnalytics(cls)}
                    >
                      <BarChart className="h-4 w-4 mr-2" />
                      View Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Removed duplicate placeholder Analytics Dialog */}

        {/* Analytics Dialog */}
        <Dialog open={showAnalytics} onOpenChange={setShowAnalytics}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart className="h-5 w-5" />
                  Class Analytics
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => selectedAnalyticsClass && fetchAnalytics(selectedAnalyticsClass)}
                  disabled={analyticsLoading}
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
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
                Detailed attendance analytics and student performance.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {analyticsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading analytics...</p>
                </div>
              ) : !analyticsData ? (
                <div className="text-center py-12">
                  <BarChart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
                  <p className="text-muted-foreground">
                    No attendance data found for this class.
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                        <div className="text-2xl font-bold">{analyticsData.totalStudents}</div>
                        <div className="text-sm text-muted-foreground">Total Enrolled</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Clock className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <div className="text-2xl font-bold">{analyticsData.totalSessions}</div>
                        <div className="text-sm text-muted-foreground">Total Sessions</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <BarChart className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                        <div className="text-2xl font-bold">{analyticsData.averageAttendance}%</div>
                        <div className="text-sm text-muted-foreground">Average Attendance</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <GraduationCap className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                        <div className="text-2xl font-bold">
                          {analyticsData.studentAttendance.filter((s: any) => s.attendancePercentage >= 75).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Students ≥75%</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Latest Session Pie Chart */}
                  {analyticsData.latestSession && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Latest Session Breakdown</CardTitle>
                        <CardDescription>
                          {new Date(analyticsData.latestSession.date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div className="p-3 bg-green-50 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">
                                  {analyticsData.latestSession.presentCount}
                                </div>
                                <div className="text-sm text-green-700">Present</div>
                              </div>
                              <div className="p-3 bg-red-50 rounded-lg">
                                <div className="text-2xl font-bold text-red-600">
                                  {analyticsData.latestSession.absentCount}
                                </div>
                                <div className="text-sm text-red-700">Absent</div>
                              </div>
                              <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                                <div className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                                  {analyticsData.latestSession.notMarkedCount}
                                </div>
                                <div className="text-sm text-gray-700 dark:text-gray-400">Not Marked</div>
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-3xl font-bold text-primary">
                                {analyticsData.latestSession.attendancePercentage}%
                              </div>
                              <div className="text-sm text-muted-foreground">Attendance Rate</div>
                            </div>
                          </div>
                          <div className="h-64">
                            {analyticsData.pieChartData && analyticsData.pieChartData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={analyticsData.pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                  >
                                    {analyticsData.pieChartData.map((entry: any, index: number) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip />
                                  <Legend />
                                </PieChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="flex items-center justify-center h-full text-muted-foreground">
                                No data to display
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Session-wise Attendance */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Session-wise Attendance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {analyticsData.attendanceByDate.map((session: any, index: number) => (
                          <div key={index} className="p-4 bg-muted/50 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div className="font-medium">
                                <div>{new Date(session.date).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}</div>
                                <div className="text-sm text-muted-foreground font-normal">
                                  Session: {new Date(session.timestamp).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </div>
                              </div>
                              <div className="text-lg font-bold">
                                {session.totalStudents > 0 ? ((session.presentCount / session.totalStudents) * 100).toFixed(1) : 0}%
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                                <span>Present: <strong>{session.presentCount}</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                <span>Absent: <strong>{session.absentCount}</strong></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                                <span>Not Marked: <strong>{session.notMarkedCount}</strong></span>
                              </div>
                            </div>
                            
                            <div className="mt-3">
                              <div className="text-xs text-muted-foreground mb-1">
                                Total Enrolled: {session.totalStudents} | Attendance Rate: {session.attendancePercentage}%
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                                <div className="flex h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-green-500" 
                                    style={{ 
                                      width: session.totalStudents > 0 ? `${(session.presentCount / session.totalStudents) * 100}%` : '0%'
                                    }}
                                  ></div>
                                  <div 
                                    className="bg-red-500" 
                                    style={{ 
                                      width: session.totalStudents > 0 ? `${(session.absentCount / session.totalStudents) * 100}%` : '0%'
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Student-wise Performance */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Student Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {analyticsData.studentAttendance.map((student: any, index: number) => (
                          <div key={student.student_id || index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${
                                student.attendancePercentage >= 90 ? 'bg-green-500' :
                                student.attendancePercentage >= 75 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`} />
                              <div>
                                <div className="font-medium">{student.student_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  ID: {student.student_unique_id}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">
                                {student.attendancePercentage.toFixed(1)}%
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {student.presentDays}/{student.totalSessions} sessions
                              </div>
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

        {/* Sessions Dialog */}
        <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Attendance Sessions</DialogTitle>
              <DialogDescription>
                View all attendance sessions for this class. Click on a session to see detailed attendance.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {loadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2">Loading sessions...</span>
                </div>
              ) : attendanceSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No attendance sessions found for this class.
                </div>
              ) : (
                <div className="grid gap-2">
                  {attendanceSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleViewSessionDetail(session.id, session.timestamp || session.date)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">
                              {new Date(session.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </h4>
                            <span className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-md">
                              {new Date(session.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Session created at: {new Date(session.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Students Present: <span className="font-medium text-green-600">{session.present_count}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFromSessionsList(session.timestamp || session.date, 'detailed');
                            }}
                            title="Download Detailed Report"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowSessionsDialog(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Calendar Dialog */}
        <Dialog open={showCalendarDialog} onOpenChange={setShowCalendarDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Attendance Calendar
              </DialogTitle>
              <DialogDescription>
                {selectedCalendarClass && (
                  <div className="mb-3 p-3 bg-primary/10 rounded-lg">
                    <div className="font-medium text-primary">
                      {selectedCalendarClass.class_name} - Section {selectedCalendarClass.section}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Click on any date to view attendance sessions conducted on that day.
                    </div>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Custom Calendar Component */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <CalendarComponent 
                    selectedDate={selectedDate}
                    onDateSelect={handleDateSelect}
                  />
                </CardContent>
              </Card>

              {/* Selected Date Sessions */}
              {selectedDate && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Sessions on {selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingDateSessions ? (
                      <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading sessions...</p>
                      </div>
                    ) : selectedDateSessions.length === 0 ? (
                      <div className="text-center py-8">
                        <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">No Sessions Found</h3>
                        <p className="text-muted-foreground">
                          No attendance sessions were conducted on this date.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDateSessions.map((session, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                <Clock className="h-6 w-6 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">
                                  Session at {new Date(session.session_time || session.timestamp).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {session.present_count || 0} present, {session.absent_count || 0} absent
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCalendarSessionDetail(session)}
                                className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all duration-200"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCalendarPDFDownload(session)}
                                className="hover:bg-green-50 hover:border-green-300 hover:text-green-600 transition-all duration-200"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowCalendarDialog(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Session Detail Dialog */}
        <Dialog open={showSessionDetailDialog} onOpenChange={setShowSessionDetailDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Session Attendance Details</DialogTitle>
              <DialogDescription>
                Detailed attendance for {selectedSessionDate ? new Date(selectedSessionDate).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                }) : 'Selected Session'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {loadingSessionDetail ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2">Loading attendance details...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {sessionDetailData.filter(student => student.status === 'present').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Present</div>
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {sessionDetailData.filter(student => student.status === 'absent').length}
                        </div>
                        <div className="text-sm text-muted-foreground">Absent</div>
                      </div>
                    </Card>
                  </div>

                  {/* Attendance List */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Student Attendance</h4>
                    {sessionDetailData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No students found for this session.
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {sessionDetailData.map((student) => (
                          <div
                            key={student.student_id}
                            className={`p-3 border rounded-lg flex items-center justify-between ${
                              student.status === 'present' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div>
                              <div className="font-medium">{student.student_name}</div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge
                                variant={student.status === 'present' ? 'default' : 'destructive'}
                                className={student.status === 'present' ? 'bg-green-600' : ''}
                              >
                                {student.status}
                              </Badge>
                              {student.marked_at && (
                                <div className="text-xs text-muted-foreground">
                                  {new Date(student.marked_at).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between space-x-2 pt-4">
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleDownloadPDF('detailed')}
                  disabled={!sessionDetailData.length}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Detailed Report
                </Button>
                <Button
                  onClick={() => handleDownloadPDF('summary')}
                  disabled={!sessionDetailData.length}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Summary
                </Button>
              </div>
              <Button variant="outline" onClick={() => setShowSessionDetailDialog(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manual Attendance Dialog */}
        <Dialog open={showManualAttendance} onOpenChange={setShowManualAttendance}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Manual Attendance - {selectedManualAttendanceClass?.class_name} ({selectedManualAttendanceClass?.section})
              </DialogTitle>
              <DialogDescription>
                Mark attendance for students enrolled in this class. Today's date: {new Date().toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>
            
            {loadingStudents ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">Loading students...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No students enrolled in this class.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-medium">Total Students: {enrolledStudents.length}</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newData: {[key: string]: 'present' | 'absent'} = {};
                            enrolledStudents.forEach(student => {
                              newData[student.student_id] = 'present';
                            });
                            setManualAttendanceData(newData);
                          }}
                        >
                          Mark All Present
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newData: {[key: string]: 'present' | 'absent'} = {};
                            enrolledStudents.forEach(student => {
                              newData[student.student_id] = 'absent';
                            });
                            setManualAttendanceData(newData);
                          }}
                        >
                          Mark All Absent
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {enrolledStudents.map((student: any) => (
                        <Card key={student.student_id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{student.profiles?.name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{student.profiles?.unique_id || 'N/A'}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant={manualAttendanceData[student.student_id] === 'present' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleAttendanceToggle(student.student_id, 'present')}
                                className={manualAttendanceData[student.student_id] === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                              >
                                Present
                              </Button>
                              <Button
                                variant={manualAttendanceData[student.student_id] === 'absent' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleAttendanceToggle(student.student_id, 'absent')}
                                className={manualAttendanceData[student.student_id] === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                              >
                                Absent
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                    
                    <div className="flex justify-between items-center pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        Present: {Object.values(manualAttendanceData).filter(status => status === 'present').length} | 
                        Absent: {Object.values(manualAttendanceData).filter(status => status === 'absent').length}
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowManualAttendance(false)}
                          disabled={submittingAttendance}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSubmitManualAttendance}
                          disabled={submittingAttendance}
                          className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700"
                        >
                          {submittingAttendance ? 'Submitting...' : 'Submit Attendance'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Coming Soon Dialog */}
        <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-center justify-center">
                <Camera className="h-6 w-6 text-purple-600" />
                Face Recognition Attendance
              </DialogTitle>
            </DialogHeader>
            
            <div className="text-center py-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                <Camera className="h-8 w-8 text-purple-600" />
              </div>
              
              <h3 className="text-lg font-semibold mb-2">Coming Soon!</h3>
              <p className="text-muted-foreground mb-6">
                Face recognition attendance feature is currently in development. This will allow automatic attendance marking using advanced facial recognition technology.
              </p>
              
              <Button 
                onClick={() => setShowComingSoon(false)}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white"
              >
                Got it!
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Attendance Session Dialog */}
        <Dialog open={showAttendanceSession} onOpenChange={setShowAttendanceSession}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-emerald-600" />
                Start Attendance Session
              </DialogTitle>
              <DialogDescription>
                Choose your preferred method to mark attendance for {currentSessionClass?.class_name} ({currentSessionClass?.section})
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 py-4">
              <Button
                onClick={() => {
                  setShowAttendanceSession(false);
                  handleGenerateQR(currentSessionClass?.id);
                }}
                disabled={isGeneratingQR}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 justify-start"
                size="lg"
              >
                <QrCode className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Generate QR Code</div>
                  <div className="text-xs opacity-90">Students scan QR to mark attendance</div>
                </div>
              </Button>
              
              <Button
                onClick={() => {
                  setShowAttendanceSession(false);
                  handleManualAttendance(currentSessionClass);
                }}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 justify-start"
                size="lg"
              >
                <UserCheck className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Manual Attendance</div>
                  <div className="text-xs opacity-90">Mark attendance manually for each student</div>
                </div>
              </Button>
              
              <Button
                onClick={() => {
                  setShowAttendanceSession(false);
                  handleHybridAttendance(currentSessionClass);
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 justify-start"
                size="lg"
              >
                <Shuffle className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Hybrid Attendance</div>
                  <div className="text-xs opacity-90">QR code + manual marking in one session</div>
                </div>
              </Button>
              
              <Button
                onClick={() => {
                  setShowAttendanceSession(false);
                  setShowComingSoon(true);
                }}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 justify-start"
                size="lg"
              >
                <Camera className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Face Recognition</div>
                  <div className="text-xs opacity-90">Automatic attendance via facial recognition</div>
                </div>
              </Button>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAttendanceSession(false)}
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Hybrid Attendance Dialog */}
        <Dialog open={showHybridAttendance} onOpenChange={setShowHybridAttendance}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shuffle className="h-6 w-6 text-blue-600" />
                Hybrid Attendance Session
              </DialogTitle>
              <DialogDescription>
                {currentSessionClass && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border">
                    <div className="font-medium text-blue-800">
                      {currentSessionClass.class_name} - Section {currentSessionClass.section}
                    </div>
                    <div className="text-sm text-blue-600">
                      Class Code: <span className="font-mono">{currentSessionClass.class_code}</span>
                    </div>
                    <div className="text-sm text-blue-600 mt-2">
                      Students can scan the QR code or you can mark them manually
                    </div>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* QR Code Section */}
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-gradient-to-br from-emerald-50 to-green-50">
                  <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    QR Code for Students
                  </h3>
                  {hybridQrCodeUrl ? (
                    <div className="text-center">
                      <img src={hybridQrCodeUrl} alt="QR Code" className="mx-auto w-48 h-48 border rounded-lg shadow-md" />
                      <p className="text-sm text-emerald-600 mt-2">Students can scan this QR code to mark attendance</p>
                      <p className="text-xs text-emerald-500 mt-1">QR code expires in 5 minutes</p>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-emerald-600">Generating QR Code...</p>
                    </div>
                  )}
                </div>

                {/* Live Attendance from QR Scans */}
                <div className="p-4 border rounded-lg bg-gradient-to-br from-green-50 to-emerald-50">
                  <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Students Marked via QR ({hybridAttendanceRecords.length})
                  </h3>
                  {hybridAttendanceRecords.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {hybridAttendanceRecords.map((record, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-green-100 rounded text-sm">
                          <div>
                            <div className="font-medium text-green-800">{record.profiles?.name}</div>
                            <div className="text-green-600">{record.profiles?.unique_id}</div>
                          </div>
                          <div className="text-green-600 font-medium">
                            {new Date(record.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-600">No students have scanned the QR code yet</p>
                  )}
                </div>
              </div>

              {/* Manual Attendance Section */}
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-gradient-to-br from-orange-50 to-amber-50">
                  <h3 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Manual Attendance
                  </h3>
                  {loadingHybridStudents ? (
                    <div className="text-center py-8">
                      <div className="animate-spin h-6 w-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm text-orange-600">Loading students...</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {hybridEnrolledStudents.map((student) => {
                        const isMarkedByQR = hybridAttendanceRecords.some(record => record.student_id === student.student_id);
                        const currentStatus = hybridManualAttendanceData[student.student_id] || 'pending';
                        
                        return (
                          <div key={student.student_id} className={`p-3 rounded-lg border ${
                            isMarkedByQR ? 'bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-800 dark:text-gray-200">{student.name}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{student.unique_id}</div>
                                {isMarkedByQR && (
                                  <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                                    ✓ Already marked via QR code
                                  </div>
                                )}
                              </div>
                              {!isMarkedByQR && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant={currentStatus === 'present' ? 'default' : 'outline'}
                                    className={currentStatus === 'present' ? 'bg-green-600 hover:bg-green-700' : 'border-green-600 text-green-600 hover:bg-green-50'}
                                    onClick={() => handleHybridAttendanceToggle(student.student_id, 'present')}
                                  >
                                    Present
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={currentStatus === 'absent' ? 'destructive' : 'outline'}
                                    className={currentStatus === 'absent' ? '' : 'border-red-600 text-red-600 hover:bg-red-50'}
                                    onClick={() => handleHybridAttendanceToggle(student.student_id, 'absent')}
                                  >
                                    Absent
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Section */}
            <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-lg border dark:border-slate-600">
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Session Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{hybridEnrolledStudents.length}</div>
                  <div className="text-gray-600 dark:text-gray-400">Total Students</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{hybridAttendanceRecords.length}</div>
                  <div className="text-gray-600 dark:text-gray-400">QR Scanned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {(() => {
                      const manuallyMarked = Object.entries(hybridManualAttendanceData).filter(([studentId, status]) => 
                        (status === 'present' || status === 'absent') && 
                        !hybridAttendanceRecords.find(record => record.student_id === studentId)
                      );
                      return manuallyMarked.length;
                    })()}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">Manual Marked</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {(() => {
                      const qrMarked = hybridAttendanceRecords.length;
                      const manualMarked = Object.entries(hybridManualAttendanceData).filter(([studentId, status]) => 
                        (status === 'present' || status === 'absent') && 
                        !hybridAttendanceRecords.find(record => record.student_id === studentId)
                      ).length;
                      return Math.max(0, hybridEnrolledStudents.length - qrMarked - manualMarked);
                    })()}
                  </div>
                  <div className="text-gray-600">Pending</div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => setShowHybridAttendance(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitHybridAttendance}
                disabled={submittingHybridAttendance}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submittingHybridAttendance && <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />}
                Complete Hybrid Session
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default FacultyDashboard;