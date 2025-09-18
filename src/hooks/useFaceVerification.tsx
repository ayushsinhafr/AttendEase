import { useState } from 'react';

export interface FaceVerificationState {
  isOpen: boolean;
  isRequired: boolean;
  sessionInfo: {
    sessionId: string;
    sessionDate: string;
    sessionDateTime: string;
  } | null;
  classId: string | null;
  studentId: string | null;
}

export function useFaceVerification() {
  const [verificationState, setVerificationState] = useState<FaceVerificationState>({
    isOpen: false,
    isRequired: false,
    sessionInfo: null,
    classId: null,
    studentId: null
  });

  const [pendingAttendanceCallback, setPendingAttendanceCallback] = useState<(() => Promise<boolean>) | null>(null);

  const requireFaceVerification = (
    classId: string,
    studentId: string,
    sessionInfo: {
      sessionId: string;
      sessionDate: string;
      sessionDateTime: string;
    },
    onSuccess: () => Promise<boolean>
  ) => {
    setVerificationState({
      isOpen: true,
      isRequired: true,
      sessionInfo,
      classId,
      studentId
    });
    setPendingAttendanceCallback(() => onSuccess);
  };

  const handleVerificationSuccess = async () => {
    if (pendingAttendanceCallback) {
      await pendingAttendanceCallback();
    }
    closeFaceVerification();
  };

  const closeFaceVerification = () => {
    setVerificationState({
      isOpen: false,
      isRequired: false,
      sessionInfo: null,
      classId: null,
      studentId: null
    });
    setPendingAttendanceCallback(null);
  };

  return {
    verificationState,
    requireFaceVerification,
    handleVerificationSuccess,
    closeFaceVerification
  };
}