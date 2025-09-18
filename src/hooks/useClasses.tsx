import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { AttendanceSessionManager } from "@/lib/sessionManager";

export interface Class {
  id: string;
  class_name: string;
  section: string;
  class_code: string;
  faculty_id: string;
  student_strength: number;
  qr_token: string | null;
  qr_expiration: string | null;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  enrolled_at: string;
  classes: Class;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  timestamp: string;
  status: 'present' | 'absent';
  session_date: string;
  profiles?: {
    name: string;
    unique_id: string;
  };
}

export const useClasses = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [classes, setClasses] = useState<Class[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoadingRef, setIsLoadingRef] = useState(false);

  // Fetch faculty's classes
  const fetchFacultyClasses = useCallback(async () => {
    if (!user || profile?.role !== 'faculty' || isLoadingRef) return;
    
    setIsLoadingRef(true);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('faculty_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClasses(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: "Error fetching classes",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsLoadingRef(false);
    }
  }, [user, profile?.role]);

  // Fetch student's enrolled classes
  const fetchStudentClasses = useCallback(async () => {
    if (!user || profile?.role !== 'student' || isLoadingRef) return;
    
    setIsLoadingRef(true);
    setLoading(true);
    try {
      // First get enrollments, then fetch class details separately to avoid relation issues
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('*')
        .eq('student_id', user.id);

      if (enrollmentError) throw enrollmentError;

      if (enrollmentData && enrollmentData.length > 0) {
        // Get class IDs and fetch class details
        const classIds = enrollmentData.map(e => e.class_id);
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('*')
          .in('id', classIds);

        if (classError) throw classError;

        // Combine enrollment and class data
        const enrichedEnrollments = enrollmentData.map(enrollment => ({
          ...enrollment,
          classes: classData?.find(cls => cls.id === enrollment.class_id) || {} as Class
        }));

        setEnrollments(enrichedEnrollments as Enrollment[]);
      } else {
        setEnrollments([]);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: "Error fetching enrolled classes",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setIsLoadingRef(false);
    }
  }, [user, profile?.role]);

  // Create a new class
  const createClass = async (className: string, section: string, studentStrength: number) => {
    if (!user || profile?.role !== 'faculty') return null;

    try {
      // Generate class code using the database function
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_class_code', {
          class_name: className,
          section: section
        });

      if (codeError) throw codeError;

      const { data, error } = await supabase
        .from('classes')
        .insert({
          class_name: className,
          section: section,
          class_code: codeData,
          faculty_id: user.id,
          student_strength: studentStrength,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Class created successfully!",
        description: `Class code: ${data.class_code} - Share this code with students to join your class.`,
      });

      await fetchFacultyClasses();
      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: "Error creating class",
        description: errorMessage,
        variant: "destructive",
      });
      return null;
    }
  };

  // Join a class (for students)
  const joinClass = async (classCode: string) => {
    if (!user || profile?.role !== 'student') return false;

    try {
      console.log('🎯 [joinClass] Starting with code:', classCode);
      console.log('🎯 [joinClass] User ID:', user.id);
      
      // First, find the class by code
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('class_code', classCode)
        .maybeSingle();

      console.log('🏫 [joinClass] Class lookup result:', { classData, classError });

      if (classError) {
        console.error('❌ [joinClass] Database error:', classError);
        toast({
          title: "Database error",
          description: "There was an error checking the class. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (!classData) {
        console.log('❌ [joinClass] Class not found with code:', classCode);
        toast({
          title: "Class not found",
          description: "Invalid class code. Please check and try again.",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ [joinClass] Class found:', classData.id);

      // Check if already enrolled
      const { data: existingEnrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', user.id)
        .eq('class_id', classData.id)
        .maybeSingle();

      console.log('🔍 [joinClass] Existing enrollment check:', existingEnrollment);

      if (existingEnrollment) {
        console.log('⚠️ [joinClass] Already enrolled');
        toast({
          title: "Already enrolled",
          description: "You are already enrolled in this class.",
          variant: "destructive",
        });
        return false;
      }

      console.log('📝 [joinClass] Creating enrollment...');

      // Enroll in the class
      const enrollmentData = {
        student_id: user.id,
        class_id: classData.id,
      };

      console.log('📝 [joinClass] Enrollment data:', enrollmentData);

      const { error } = await supabase
        .from('enrollments')
        .insert(enrollmentData);

      if (error) {
        console.error('❌ [joinClass] Enrollment error:', error);
        throw error;
      }

      console.log('✅ [joinClass] Successfully enrolled!');

      toast({
        title: "Successfully joined class!",
        description: "You have been enrolled in the class.",
      });

      await fetchStudentClasses();
      return true;
    } catch (error: unknown) {
      console.error('💥 [joinClass] Fatal error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: "Error joining class",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  };

  // Generate QR token for attendance
  const generateQRToken = useCallback(async (classId: string): Promise<string | null> => {
    // Input validation
    if (!classId || typeof classId !== 'string' || classId.trim() === '') {
      console.error('Invalid classId provided to generateQRToken:', classId);
      toast({
        title: "Error",
        description: "Invalid class ID provided",
        variant: "destructive",
      });
      return null;
    }

    if (!user || profile?.role !== 'faculty') {
      console.error('Unauthorized access to generateQRToken');
      toast({
        title: "Error",
        description: "You must be logged in as faculty to generate QR codes",
        variant: "destructive",
      });
      return null;
    }

    try {
      console.log('Generating QR token for class:', classId);
      
      // Verify the class exists and belongs to the current faculty
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, class_name, faculty_id')
        .eq('id', classId)
        .eq('faculty_id', user.id)
        .maybeSingle();

      if (classError) {
        console.error('Error verifying class:', classError);
        throw new Error('Failed to verify class ownership');
      }

      if (!classData) {
        console.error('Class not found or not owned by current faculty:', classId);
        toast({
          title: "Error",
          description: "Class not found or you don't have permission to generate QR for this class",
          variant: "destructive",
        });
        return null;
      }
      
      // Create a unique session with timestamp
      const sessionTimestamp = new Date();
      const sessionId = `${classId}:${sessionTimestamp.getTime()}`;
      const token = sessionId;
      const expiration = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      // Format session date with time for unique identification
      const sessionDateWithTime = sessionTimestamp.toISOString();

      const { error: updateError } = await supabase
        .from('classes')
        .update({
          qr_token: token,
          qr_expiration: expiration.toISOString()
        })
        .eq('id', classId)
        .eq('faculty_id', user.id); // Double-check ownership

      if (updateError) {
        console.error('Error updating class with QR token:', updateError);
        throw new Error('Failed to save QR token to database');
      }

      console.log('QR token generated successfully for class:', classData.class_name);
      console.log('New session created at:', sessionDateWithTime);
      
      // Set timer to auto-mark absent students when QR expires
      setTimeout(async () => {
        try {
          await markAbsentStudents(classId, sessionDateWithTime);
          console.log('Auto-marked absent students for session:', sessionDateWithTime);
        } catch (error) {
          console.error('Error auto-marking absent students:', error);
        }
      }, 5 * 60 * 1000); // 5 minutes

      toast({
        title: "Success",
        description: `QR code generated for ${classData.class_name}. Valid for 5 minutes.`,
      });

      return token;
    } catch (error) {
      console.error('Error generating QR token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to generate QR code: ${errorMessage}`,
        variant: "destructive",
      });
      return null;
    }
  }, [user, profile?.role, toast]);

  // Generate QR token specifically for face verification attendance
  const generateQRTokenWithFaceVerification = useCallback(async (classId: string): Promise<string | null> => {
    // Input validation
    if (!classId || typeof classId !== 'string' || classId.trim() === '') {
      console.error('Invalid classId provided to generateQRTokenWithFaceVerification:', classId);
      toast({
        title: "Error",
        description: "Invalid class ID provided",
        variant: "destructive",
      });
      return null;
    }

    if (!user || profile?.role !== 'faculty') {
      console.error('Unauthorized access to generateQRTokenWithFaceVerification');
      toast({
        title: "Error",
        description: "You must be logged in as faculty to generate QR codes",
        variant: "destructive",
      });
      return null;
    }

    try {
      console.log('Generating face verification QR token for class:', classId);
      
      // Verify the class exists and belongs to the current faculty
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, class_name, faculty_id')
        .eq('id', classId)
        .eq('faculty_id', user.id)
        .maybeSingle();

      if (classError) {
        console.error('Error verifying class:', classError);
        throw new Error('Failed to verify class ownership');
      }

      if (!classData) {
        console.error('Class not found or not owned by current faculty:', classId);
        toast({
          title: "Error",
          description: "Class not found or you don't have permission to generate QR for this class",
          variant: "destructive",
        });
        return null;
      }
      
      // Create a unique session with timestamp and face verification flag
      const sessionTimestamp = new Date();
      const sessionId = `${classId}:${sessionTimestamp.getTime()}`;
      const token = `${sessionId}:FACE_VERIFICATION`; // Add face verification marker
      const expiration = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      const { error: updateError } = await supabase
        .from('classes')
        .update({
          qr_token: token,
          qr_expiration: expiration.toISOString()
        })
        .eq('id', classId)
        .eq('faculty_id', user.id);

      if (updateError) {
        console.error('Error updating class with face verification QR token:', updateError);
        throw new Error('Failed to save QR token to database');
      }

      toast({
        title: "Success",
        description: `Face recognition QR code generated for ${classData.class_name}. Students will be prompted for face verification.`,
      });

      return token;
    } catch (error) {
      console.error('Error generating face verification QR token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Error",
        description: `Failed to generate face recognition QR code: ${errorMessage}`,
        variant: "destructive",
      });
      return null;
    }
  }, [user, profile?.role, toast]);

  // Get live attendance data for a class session
  // Get live attendance data for a class session with optimized queries
  const getLiveAttendance = useCallback(async (classId: string, sessionDate?: string) => {
    try {
      // Format date as DD-MM-YYYY to match database
      const today = new Date();
      const formattedDate = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getFullYear()}`;
      const dateFilter = sessionDate || formattedDate;
      
      // Optimized query using new composite index idx_attendance_class_date
      // Combined query to get class info and attendance in parallel for better performance
      const [classResult, attendanceResult] = await Promise.all([
        supabase
          .from('classes')
          .select('student_strength, class_name')
          .eq('id', classId)
          .maybeSingle(),
        
        supabase
          .from('attendance')
          .select(`
            student_id,
            status,
            timestamp,
            profiles:student_id (
              name,
              unique_id
            )
          `)
          .eq('class_id', classId)
          .eq('session_date', dateFilter)
          .order('timestamp', { ascending: false })
      ]);

      const { data: classData, error: classError } = classResult;
      const { data: attendanceData, error: attendanceError } = attendanceResult;

      if (classError) {
        console.error('Error fetching class:', classError);
        throw classError;
      }
      if (!classData) {
        throw new Error('Class not found');
      }

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        throw attendanceError;
      }

      console.log('Optimized attendance query result:', attendanceData?.length, 'records for', classData.class_name);
      
      // The attendance data now includes student profiles from the join
      // No need for separate student lookup query
      
      // Get all enrolled students with optimized query using new index
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          profiles:student_id (
            name,
            unique_id
          )
        `)
        .eq('class_id', classId);

      if (enrollmentError) {
        console.error('Error fetching enrollments:', enrollmentError);
        throw enrollmentError;
      }

      console.log('Optimized enrollment query result:', enrollmentData?.length, 'enrolled students');

      // Process attendance summary using optimized data
      // attendanceData already includes profile information from the join
      const presentStudents = attendanceData?.filter(a => a.status === 'present') || [];
      const absentStudents = attendanceData?.filter(a => a.status === 'absent') || [];
      const attendedStudentIds = new Set(attendanceData?.map(a => a.student_id) || []);
      
      // Find students who haven't marked attendance yet (only from enrolled students)
      const notMarkedStudents = enrollmentData?.filter(e => 
        !attendedStudentIds.has(e.student_id)
      ) || [];

      // Use class strength as total capacity, actual enrollments for calculations
      const totalClassStrength = classData?.student_strength || 0;
      const actualEnrolled = enrollmentData?.length || 0;

      console.log('Processed attendance data with optimization:', {
        presentStudents: presentStudents.length,
        absentStudents: absentStudents.length,
        notMarkedStudents: notMarkedStudents.length,
        totalEnrolled: actualEnrolled,
        totalClassStrength: totalClassStrength
      });

      return {
        presentStudents,
        absentStudents,
        notMarkedStudents,
        totalEnrolled: actualEnrolled, // Actual enrolled students
        totalClassStrength: totalClassStrength, // Expected class strength
        sessionDate: dateFilter
      };
    } catch (error) {
      console.error('Error fetching live attendance:', error);
      return {
        presentStudents: [],
        absentStudents: [],
        notMarkedStudents: [],
        totalEnrolled: 0,
        totalClassStrength: 0,
        sessionDate: sessionDate || new Date().toISOString().split('T')[0]
      };
    }
  }, []);

  // Function to mark absent students who didn't mark attendance (optimized)
  const markAbsentStudents = useCallback(async (classId: string, sessionDateTime?: string) => {
    try {
      // Use session date time or fallback to today's date format
      const sessionDate = sessionDateTime || new Date().toISOString().split('T')[0];
      
      // Optimized query using new composite indexes
      // Get enrolled students and existing attendance in parallel
      const [enrollmentsResult, attendanceResult] = await Promise.all([
        supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_id', classId),
        
        supabase
          .from('attendance')
          .select('student_id')
          .eq('class_id', classId)
          .eq('session_date', sessionDate)
      ]);

      const { data: enrollments, error: enrollError } = enrollmentsResult;
      const { data: existingAttendance, error: existingAttendanceError } = attendanceResult;

      if (enrollError) throw enrollError;
      if (existingAttendanceError) throw existingAttendanceError;

      // Create set of students who already have attendance records (optimized)
      const attendedStudentIds = new Set(existingAttendance?.map(s => s.student_id) || []);
      
      // Find students who need to be marked absent
      const absentStudents = enrollments?.filter(e => !attendedStudentIds.has(e.student_id)) || [];

      // Mark absent students with batch insert for better performance
      if (absentStudents.length > 0) {
        const sessionDateFormatted = sessionDateTime ? sessionDateTime.split('T')[0] : sessionDate;
        const timestampFormatted = sessionDateTime || new Date().toISOString();
        
        const absentRecords = absentStudents.map(student => ({
          student_id: student.student_id,
          class_id: classId,
          status: 'absent' as const,
          session_date: sessionDateFormatted,
          timestamp: timestampFormatted
        }));

        // Use upsert for better performance and conflict handling
        const { error: insertError } = await supabase
          .from('attendance')
          .upsert(absentRecords, { 
            onConflict: 'student_id,class_id,session_date',
            ignoreDuplicates: true 
          });

        if (insertError) throw insertError;
        
        console.log(`Optimized batch insert: Marked ${absentStudents.length} students as absent for session:`, sessionDateFormatted);
        return absentStudents.length;
      }
      return 0;
    } catch (error) {
      console.error('Error marking absent students:', error);
      return 0;
    }
  }, []);

  // Mark attendance using QR token
  const markAttendance = async (token: string) => {
    if (!user || profile?.role !== 'student') return false;

    try {
      console.log('🎯 [markAttendance] Starting attendance marking with token:', token);
      
      // Get the current session to ensure we have a valid auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('❌ [markAttendance] No session found');
        toast({
          title: "Authentication required",
          description: "Please log in again to mark attendance.",
          variant: "destructive",
        });
        return false;
      }
      
      console.log('✅ [markAttendance] Session found, user ID:', user.id);
      
      // Use direct implementation for regular QR tokens
      console.log('⚡ [markAttendance] Using direct implementation for regular QR token');
      return await markAttendanceDirect(token);

    } catch (error) {
      console.error('💥 [markAttendance] Fatal error:', error);
      toast({
        title: "Error marking attendance",
        description: "Failed to mark attendance. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Direct implementation as fallback
  const markAttendanceDirect = async (token: string): Promise<boolean> => {
    try {
      console.log('🔧 [markAttendanceDirect] Starting with token:', token);
      
      // Find the class with this token and check if it's still valid
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, qr_expiration')
        .eq('qr_token', token)
        .maybeSingle();

      console.log('🏫 [markAttendanceDirect] Class lookup result:', { classData, classError });

      if (classError) {
        console.log('❌ [markAttendanceDirect] Database error:', classError);
        return false;
      }

      if (!classData) {
        console.log('❌ [markAttendanceDirect] Invalid token or class not found');
        toast({
          title: "Invalid QR Code",
          description: "Invalid QR code. Make sure you're scanning the correct code.",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ [markAttendanceDirect] Class found:', classData.id);

      // Check if token is still valid
      const now = new Date();
      const expiration = new Date(classData.qr_expiration || 0);
      
      console.log('⏰ [markAttendanceDirect] Time check:', { now: now.toISOString(), expiration: expiration.toISOString() });
      
      if (now > expiration) {
        console.log('❌ [markAttendanceDirect] Token expired');
        toast({
          title: "QR Code Expired",
          description: "QR code has expired. Ask teacher to generate a new one.",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ [markAttendanceDirect] Token is valid');

      // Check if student is enrolled in this class
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', user!.id)
        .eq('class_id', classData.id)
        .maybeSingle();

      console.log('👥 [markAttendanceDirect] Enrollment check:', { enrollmentData, enrollmentError });

      if (enrollmentError || !enrollmentData) {
        console.log('❌ [markAttendanceDirect] Student not enrolled in class');
        toast({
          title: "Not Enrolled",
          description: "You are not enrolled in this class. Please join the class first.",
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ [markAttendanceDirect] Student is enrolled');

      // Decode session information from QR token using session manager
      const tokenInfo = AttendanceSessionManager.decodeQRToken(token);
      if (!tokenInfo || !tokenInfo.isValid) {
        console.log('❌ [markAttendanceDirect] Invalid token format');
        toast({
          title: "Invalid QR Code",
          description: "The QR code format is invalid. Please scan a valid attendance QR code.",
          variant: "destructive",
        });
        return false;
      }

      const sessionDateTime = tokenInfo.sessionTimestamp;
      const sessionDate = sessionDateTime.split('T')[0];
      
      console.log('📅 [markAttendanceDirect] Decoded session info:', { 
        sessionId: tokenInfo.sessionId,
        sessionDateTime, 
        sessionDate,
        classId: tokenInfo.classId 
      });
      
      // Verify the class ID from token matches the one from database
      if (tokenInfo.classId !== classData.id) {
        console.log('❌ [markAttendanceDirect] Class ID mismatch');
        toast({
          title: "Invalid QR Code",
          description: "This QR code is for a different class.",
          variant: "destructive",
        });
        return false;
      }
      
      // Check if attendance was already marked for this specific session
      const { data: existingAttendance } = await supabase
        .from('attendance')
        .select('id, timestamp')
        .eq('student_id', user!.id)
        .eq('class_id', classData.id)
        .eq('session_date', sessionDate)
        .eq('timestamp', sessionDateTime) // Use exact timestamp match instead of gte
        .maybeSingle();

      console.log('🔍 [markAttendanceDirect] Existing attendance check for session:', existingAttendance);

      if (existingAttendance) {
        console.log('⚠️ [markAttendanceDirect] Attendance already marked for this session');
        toast({
          title: "Attendance already marked!",
          description: "Your attendance for this session has already been recorded.",
        });
        
        // Refresh enrollments to update attendance status
        if (profile?.role === 'student') {
          fetchStudentClasses();
        }
        
        return true;
      }

      // Mark attendance (insert new record with session timestamp)
      const attendanceRecord = {
        student_id: user!.id,
        class_id: classData.id,
        status: 'present',
        session_date: sessionDate,
        timestamp: sessionDateTime,
      };

      console.log('💾 [markAttendanceDirect] Inserting attendance record:', attendanceRecord);

      // Try to insert the attendance record
      const { error: attendanceError } = await supabase
        .from('attendance')
        .insert(attendanceRecord);

      if (attendanceError) {
        // If it's a unique constraint violation, handle gracefully
        if (attendanceError.code === '23505') {
          console.log('⚠️ [markAttendanceDirect] Attendance already exists for this session');
          toast({
            title: "Already Marked",
            description: "Your attendance for this session has already been recorded.",
            variant: "default",
          });
          return true;
        }
        
        console.log('❌ [markAttendanceDirect] Error marking attendance:', {
          message: attendanceError.message,
          details: attendanceError.details,
          hint: attendanceError.hint,
          code: attendanceError.code,
          fullError: attendanceError
        });
        
        toast({
          title: "Database Error",
          description: `Failed to mark attendance: ${attendanceError.message}`,
          variant: "destructive",
        });
        return false;
      }

      console.log('✅ [markAttendanceDirect] Attendance marked successfully!', {
        userId: user!.id,
        classId: classData.id,
        sessionDate: sessionDate
      });
      toast({
        title: "Attendance marked!",
        description: "Your attendance has been recorded successfully.",
      });
      
      // Refresh enrollments to update attendance status
      if (profile?.role === 'student') {
        fetchStudentClasses();
      }
      // Notify teacher dashboard to refresh attendance (if callback is set)
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('attendanceMarked', {
          detail: {
            classId: classData.id,
            studentId: user!.id,
            sessionDate: sessionDate
          }
        }));
      }
      
      return true;

    } catch (error) {
      console.error('Direct attendance marking error:', error);
      toast({
        title: "Error marking attendance",
        description: "Failed to mark attendance. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Fetch attendance for a class (for faculty)
  const fetchClassAttendance = async (classId: string): Promise<AttendanceRecord[]> => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles!attendance_student_id_fkey (
            name,
            unique_id
          )
        `)
        .eq('class_id', classId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      return data as AttendanceRecord[] || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: "Error fetching attendance",
        description: errorMessage,
        variant: "destructive",
      });
      return [];
    }
  };

  // Delete a class and all related data
  const deleteClass = useCallback(async (classId: string) => {
    if (!user || profile?.role !== 'faculty') return false;

    try {
      // Delete in the correct order due to foreign key constraints
      // 1. Delete attendance records first
      const { error: attendanceError } = await supabase
        .from('attendance')
        .delete()
        .eq('class_id', classId);

      if (attendanceError) {
        console.error('Error deleting attendance records:', attendanceError);
        throw attendanceError;
      }

      // 2. Delete enrollments
      const { error: enrollmentsError } = await supabase
        .from('enrollments')
        .delete()
        .eq('class_id', classId);

      if (enrollmentsError) {
        console.error('Error deleting enrollments:', enrollmentsError);
        throw enrollmentsError;
      }

      // 3. Finally delete the class
      const { error: classError } = await supabase
        .from('classes')
        .delete()
        .eq('id', classId)
        .eq('faculty_id', user.id); // Additional security check

      if (classError) {
        console.error('Error deleting class:', classError);
        throw classError;
      }

      toast({
        title: "Class deleted successfully!",
        description: "The class and all related data have been removed.",
      });

      // Refresh the classes list
      await fetchFacultyClasses();
      return true;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast({
        title: "Error deleting class",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  }, [user, profile?.role, toast, fetchFacultyClasses]);

  // Get attendance sessions (dates when QR was generated)
  // Debug function to check database contents
  const debugDatabaseContents = useCallback(async (classId: string) => {
    try {
      console.log('🔍 [DEBUG] Checking database contents for class:', classId);
      console.log('🔍 [DEBUG] Current user:', user?.id);
      console.log('🔍 [DEBUG] Current profile:', profile);
      
      // Check enrollments with more details
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          *,
          profiles:student_id (
            user_id,
            name,
            unique_id,
            role
          )
        `)
        .eq('class_id', classId);
      
      console.log('👥 [DEBUG] Enrollments query details:', { enrollments, enrollError });
      
      // Check attendance records with more details
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          *,
          profiles:student_id (
            user_id,
            name,
            unique_id
          )
        `)
        .eq('class_id', classId);
      
      console.log('📊 [DEBUG] Attendance query details:', { attendance, attendanceError });
      
      // Check all enrollments (not filtered by class)
      const { data: allEnrollments, error: allEnrollError } = await supabase
        .from('enrollments')
        .select('*')
        .limit(10);
        
      console.log('👥 [DEBUG] All enrollments (sample):', { allEnrollments, allEnrollError });
      
      // Check all attendance records (not filtered by class)
      const { data: allAttendance, error: allAttendanceError } = await supabase
        .from('attendance')
        .select('*')
        .limit(10);
        
      console.log('📊 [DEBUG] All attendance records (sample):', { allAttendance, allAttendanceError });
      
      // Check classes
      const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('*');
      
      console.log('🏫 [DEBUG] All classes:', { classes, classError });
      
      // Check current user's session and permissions
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 [DEBUG] Current session:', { 
        user: session?.user?.id, 
        role: session?.user?.user_metadata?.role,
        sessionError 
      });
      
      return { enrollments, attendance, classes };
    } catch (error) {
      console.error('❌ [DEBUG] Error checking database:', error);
      return null;
    }
  }, [user, profile]);

  const getAttendanceSessions = useCallback(async (classId: string) => {
    try {
      console.log('🔍 [getAttendanceSessions] Starting fetch for class:', classId);
      
      // Get attendance data grouped by unique timestamps to support multiple sessions per day
      const { data: attendanceData, error } = await supabase
        .from('attendance')
        .select('session_date, timestamp')
        .eq('class_id', classId)
        .order('timestamp', { ascending: false });

      console.log('📊 [getAttendanceSessions] Raw query result:', { attendanceData, error });

      if (error) {
        console.error('❌ [getAttendanceSessions] Error fetching attendance data:', error);
        throw error;
      }

      if (!attendanceData || attendanceData.length === 0) {
        console.log('⚠️ [getAttendanceSessions] No attendance data found for class:', classId);
        return [];
      }

      console.log('✅ [getAttendanceSessions] Found attendance records:', attendanceData.length);

      // Group by unique session timestamps (multiple sessions per day)
      const uniqueSessions = new Map();
      
      attendanceData.forEach(record => {
        const sessionKey = `${record.session_date}-${record.timestamp}`;
        if (!uniqueSessions.has(sessionKey)) {
          uniqueSessions.set(sessionKey, {
            session_date: record.session_date,
            timestamp: record.timestamp
          });
        }
      });
      
      const uniqueSessionList = Array.from(uniqueSessions.values());
      console.log('📅 [getAttendanceSessions] Unique sessions:', uniqueSessionList.length);
      
      // For each unique session timestamp, get the count of present students
      const sessionsWithCounts = await Promise.all(
        uniqueSessionList.map(async (session) => {
          console.log(`🔄 [getAttendanceSessions] Processing session: ${session.timestamp}`);
          
          const { data: sessionAttendance, error: sessionError } = await supabase
            .from('attendance')
            .select('*')
            .eq('class_id', classId)
            .eq('session_date', session.session_date)
            .eq('timestamp', session.timestamp)
            .eq('status', 'present');

          console.log(`📈 [getAttendanceSessions] Present students for session ${session.timestamp}:`, { 
            count: sessionAttendance?.length || 0, 
            data: sessionAttendance,
            error: sessionError 
          });

          if (sessionError) {
            console.error('❌ [getAttendanceSessions] Error fetching session attendance:', sessionError);
            return {
              id: `${classId}-${session.timestamp}`,
              date: session.session_date,
              timestamp: session.timestamp,
              qr_generated_at: session.timestamp,
              present_count: 0
            };
          }

          const sessionData = {
            id: `${classId}-${session.timestamp}`,
            date: session.session_date,
            timestamp: session.timestamp,
            qr_generated_at: session.timestamp,
            present_count: sessionAttendance?.length || 0
          };

          console.log(`✅ [getAttendanceSessions] Session data for ${session.timestamp}:`, sessionData);
          return sessionData;
        })
      );

      console.log('🎯 [getAttendanceSessions] Final sessions with counts:', sessionsWithCounts);
      return sessionsWithCounts;

    } catch (error) {
      console.error('💥 [getAttendanceSessions] Fatal error:', error);
      return [];
    }
  }, []);

  // Get attendance details for a specific session
  const getSessionAttendance = useCallback(async (classId: string, sessionTimestamp: string) => {
    try {
      console.log('🔍 [getSessionAttendance] Starting fetch for:', { classId, sessionTimestamp });

      // Get all enrollments for this class to include absent students
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          profiles:student_id (
            user_id,
            name,
            unique_id
          )
        `)
        .eq('class_id', classId);

      console.log('👥 [getSessionAttendance] Enrollments query:', { enrollments, enrollError });

      if (enrollError) {
        console.error('❌ [getSessionAttendance] Error fetching enrollments:', enrollError);
        throw enrollError;
      }

      // Get attendance records for this specific session timestamp
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('class_id', classId)
        .eq('timestamp', sessionTimestamp);

      console.log('📊 [getSessionAttendance] Attendance query:', { attendanceData, attendanceError });

      if (attendanceError) {
        console.error('❌ [getSessionAttendance] Error fetching attendance:', attendanceError);
        throw attendanceError;
      }

      console.log('✅ [getSessionAttendance] Found enrollments:', enrollments?.length || 0);
      console.log('✅ [getSessionAttendance] Found attendance records:', attendanceData?.length || 0);

      // Create attendance map
      const attendanceMap = new Map(
        attendanceData?.map(a => [a.student_id, a]) || []
      );

      console.log('🗺️ [getSessionAttendance] Attendance map:', Array.from(attendanceMap.entries()));

      // Create the result array with all enrolled students
      const result = enrollments?.map(enrollment => {
        const studentProfile = enrollment.profiles;
        const attendanceRecord = attendanceMap.get(enrollment.student_id);
        
        const studentData = {
          student_id: enrollment.student_id,
          student_name: studentProfile?.name || 'Unknown Student',
          student_email: studentProfile?.unique_id || 'Unknown Email',
          status: attendanceRecord?.status || 'absent',
          marked_at: attendanceRecord?.timestamp || null
        };

        console.log(`👤 [getSessionAttendance] Student ${enrollment.student_id}:`, studentData);
        return studentData;
      }) || [];

      console.log('🎯 [getSessionAttendance] Final result:', result);
      console.log('📈 [getSessionAttendance] Summary:', {
        total: result.length,
        present: result.filter(s => s.status === 'present').length,
        absent: result.filter(s => s.status === 'absent').length
      });

      return result;

    } catch (error) {
      console.error('💥 [getSessionAttendance] Fatal error:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'faculty') {
      fetchFacultyClasses();
    } else if (profile?.role === 'student') {
      fetchStudentClasses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.role]); // Only depend on user ID and role, not the functions

  return {
    classes,
    enrollments,
    loading,
    createClass,
    joinClass,
    generateQRToken,
    generateQRTokenWithFaceVerification,
    markAttendance,
    markAbsentStudents,
    getLiveAttendance,
    fetchClassAttendance,
    deleteClass,
    getAttendanceSessions,
    getSessionAttendance,
    debugDatabaseContents,
    refetch: profile?.role === 'faculty' ? fetchFacultyClasses : fetchStudentClasses,
  };
};