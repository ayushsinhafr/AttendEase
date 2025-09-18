import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceData {
  student_id: string;
  student_name: string;
  student_email: string;
  status: string; // Changed from 'present' | 'absent' to string for flexibility
  marked_at?: string;
}

interface SessionData {
  classInfo: {
    class_name: string;
    section: string;
    class_code: string;
    student_strength: number;
    session_time?: string; // Optional session time
  };
  sessionDate: string;
  attendanceData: AttendanceData[];
}

export const generateAttendancePDF = (sessionData: SessionData): void => {
  try {
    const { classInfo, sessionDate, attendanceData } = sessionData;
    
    // Create new PDF document
    const doc = new jsPDF();
    
    // Add header
    doc.setFontSize(20);
    doc.setTextColor(40, 116, 166); // Primary blue color
    doc.text('QAttend - Attendance Report', 20, 20);
    
    // Add class information
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Class: ${classInfo.class_name}`, 20, 35);
    doc.text(`Section: ${classInfo.section}`, 20, 45);
    doc.text(`Class Code: ${classInfo.class_code}`, 20, 55);
    
    // Add session date
    const formattedDate = new Date(sessionDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Session Date: ${formattedDate}`, 20, 65);
    
    // Add summary statistics
    const presentCount = attendanceData.filter(student => student.status === 'present').length;
    const absentCount = attendanceData.filter(student => student.status === 'absent').length;
    const totalStudents = attendanceData.length;
    const attendancePercentage = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : '0';
    
    doc.text(`Total Students: ${totalStudents}`, 20, 80);
    doc.text(`Present: ${presentCount} | Absent: ${absentCount}`, 20, 90);
    doc.text(`Attendance Rate: ${attendancePercentage}%`, 20, 100);
    
    // Add line separator
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 110, 190, 110);
    
    // Prepare table data
    const tableHeaders = ['S.No.', 'Student Name', 'Registration no', 'Status', 'Marked At'];
    const tableData = attendanceData.map((student, index) => [
      (index + 1).toString(),
      student.student_name || 'N/A',
      student.student_email || 'N/A',
      student.status === 'present' ? 'Present' : 'Absent',
      student.marked_at 
        ? new Date(student.marked_at).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : 'Not Marked'
    ]);
    
    // Add table
    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: 120,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [40, 116, 166], // Primary blue
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' }, // S.No.
        1: { cellWidth: 50 }, // Name
        2: { cellWidth: 60 }, // Email
        3: { cellWidth: 25, halign: 'center' }, // Status
        4: { cellWidth: 30, halign: 'center' }, // Marked At
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248],
      },
      didParseCell: (data: any) => {
        // Color code the status column
        if (data.column.index === 3) { // Status column
          if (data.cell.text[0] === 'Present') {
            data.cell.styles.textColor = [22, 163, 74]; // Green for present
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.text[0] === 'Absent') {
            data.cell.styles.textColor = [239, 68, 68]; // Red for absent
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    
    // Add footer with generation timestamp
    const currentTime = new Date().toLocaleString('en-US');
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on: ${currentTime}`, 20, pageHeight - 10);
    doc.text('Powered by QAttend', 150, pageHeight - 10);
    
    // Generate filename
    const fileName = `attendance_${classInfo.class_name.replace(/\s+/g, '_')}_${classInfo.section}_${sessionDate}.pdf`;
    
    // Download the PDF
    doc.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};

export const generateSessionSummaryPDF = (sessionData: SessionData): void => {
  try {
    const { classInfo, sessionDate, attendanceData } = sessionData;
    
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(40, 116, 166);
    doc.text('Attendance Summary Report', 20, 20);
    
    // Class info
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Class: ${classInfo.class_name} - Section: ${classInfo.section}`, 20, 35);
    
    const formattedDate = new Date(sessionDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Date: ${formattedDate}`, 20, 45);
    
    // Add session time if available
    if (classInfo.session_time) {
      doc.text(`Session Time: ${classInfo.session_time}`, 20, 55);
    }
    
    // Summary boxes (adjust Y position based on whether session time is shown)
    const summaryY = classInfo.session_time ? 70 : 60;
    const presentCount = attendanceData.filter(s => s.status === 'present').length;
    const absentCount = attendanceData.filter(s => s.status === 'absent').length;
    const totalStudents = attendanceData.length;
    
    // Present students box
    doc.setFillColor(220, 252, 231);
    doc.rect(20, summaryY, 50, 30, 'F');
    doc.setTextColor(22, 163, 74);
    doc.setFontSize(24);
    doc.text(presentCount.toString(), 35, summaryY + 20);
    doc.setFontSize(10);
    doc.text('Present', 32, summaryY + 28);
    
    // Absent students box
    doc.setFillColor(254, 226, 226);
    doc.rect(80, summaryY, 50, 30, 'F');
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(24);
    doc.text(absentCount.toString(), 95, summaryY + 20);
    doc.setFontSize(10);
    doc.text('Absent', 94, summaryY + 28);
    
    // Attendance rate box
    const attendanceRate = totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(1) : '0';
    doc.setFillColor(219, 234, 254);
    doc.rect(140, summaryY, 50, 30, 'F');
    doc.setTextColor(40, 116, 166);
    doc.setFontSize(18);
    doc.text(`${attendanceRate}%`, 155, summaryY + 20);
    doc.setFontSize(10);
    doc.text('Attendance', 152, summaryY + 28);
    
    // Students list
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('Student List:', 20, summaryY + 40);
    
    // Add line separator
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(20, summaryY + 45, 190, summaryY + 45);
    
    // Prepare table data with detailed information
    const tableHeaders = ['S.No.', 'Student Name', 'Registration No.', 'Status', 'Marked At'];
    const tableData = attendanceData.map((student, index) => [
      (index + 1).toString(),
      student.student_name || 'N/A',
      student.student_email || 'N/A',
      student.status === 'present' ? 'Present' : 'Absent',
      student.marked_at 
        ? new Date(student.marked_at).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })
        : 'Not Marked'
    ]);
    
    // Add detailed table
    autoTable(doc, {
      head: [tableHeaders],
      body: tableData,
      startY: summaryY + 55,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [40, 116, 166], // Primary blue
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' }, // S.No.
        1: { cellWidth: 50 }, // Name
        2: { cellWidth: 40 }, // Registration No.
        3: { cellWidth: 25, halign: 'center' }, // Status
        4: { cellWidth: 35, halign: 'center' }, // Marked At
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.cell.section === 'body') { // Status column
          if (data.cell.text[0] === 'Present') {
            data.cell.styles.textColor = [22, 163, 74]; // Green for present
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.text[0] === 'Absent') {
            data.cell.styles.textColor = [239, 68, 68]; // Red for absent
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
    
    // Footer
    const currentTime = new Date().toLocaleString('en-US');
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on: ${currentTime}`, 20, pageHeight - 10);
    
    const fileName = `summary_${classInfo.class_name.replace(/\s+/g, '_')}_${classInfo.section}_${sessionDate}.pdf`;
    doc.save(fileName);
    
  } catch (error) {
    console.error('Error generating summary PDF:', error);
    throw new Error('Failed to generate summary PDF. Please try again.');
  }
};