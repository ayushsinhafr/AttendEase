// QAttend Logging System
// Provides structured logging with different levels for security, performance, and debugging

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class QAttendLogger {
  private static instance: QAttendLogger;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;
  private isProduction = process.env.NODE_ENV === 'production';

  private constructor() {}

  public static getInstance(): QAttendLogger {
    if (!QAttendLogger.instance) {
      QAttendLogger.instance = new QAttendLogger();
    }
    return QAttendLogger.instance;
  }

  private createLogEntry(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    context?: {
      userId?: string;
      sessionId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? JSON.stringify(data) : undefined,
      userId: context?.userId,
      sessionId: context?.sessionId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    };
  }

  private addToBuffer(entry: LogEntry) {
    this.logBuffer.push(entry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    // Console output for development
    if (!this.isProduction) {
      this.consoleOutput(entry);
    }
  }

  private consoleOutput(entry: LogEntry) {
    const color = this.getLogColor(entry.level);
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    
    console.log(
      `%c${prefix} ${entry.message}`,
      `color: ${color}; font-weight: bold`,
      entry.data ? JSON.parse(entry.data) : ''
    );

    // Special handling for security logs
    if (entry.level === 'security') {
      console.warn('🔒 SECURITY EVENT:', entry);
    }
  }

  private getLogColor(level: LogLevel): string {
    switch (level) {
      case 'debug': return '#6B7280';
      case 'info': return '#2563EB';
      case 'warn': return '#D97706';
      case 'error': return '#DC2626';
      case 'security': return '#7C2D12';
      default: return '#000000';
    }
  }

  // Public logging methods
  public debug(category: string, message: string, data?: any, context?: any) {
    const entry = this.createLogEntry('debug', category, message, data, context);
    this.addToBuffer(entry);
  }

  public info(category: string, message: string, data?: any, context?: any) {
    const entry = this.createLogEntry('info', category, message, data, context);
    this.addToBuffer(entry);
  }

  public warn(category: string, message: string, data?: any, context?: any) {
    const entry = this.createLogEntry('warn', category, message, data, context);
    this.addToBuffer(entry);
  }

  public error(category: string, message: string, error?: Error | any, context?: any) {
    const errorData = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : error;
    
    const entry = this.createLogEntry('error', category, message, errorData, context);
    this.addToBuffer(entry);
  }

  public security(category: string, message: string, data?: any, context?: any) {
    const entry = this.createLogEntry('security', category, message, data, context);
    this.addToBuffer(entry);
  }

  // Specialized logging methods for QAttend operations
  public logAttendanceOperation(
    operation: 'qr_generated' | 'qr_scanned' | 'manual_marked' | 'hybrid_started' | 'session_completed',
    classId: string,
    userId: string,
    sessionId?: string,
    additionalData?: any
  ) {
    this.info('attendance', `Attendance operation: ${operation}`, {
      operation,
      classId,
      sessionId,
      ...additionalData
    }, { userId, sessionId });
  }

  public logSecurityEvent(
    event: 'unauthorized_access' | 'invalid_qr' | 'rate_limit_exceeded' | 'suspicious_activity',
    details: any,
    context?: any
  ) {
    this.security('security', `Security event: ${event}`, details, context);
  }

  public logPerformance(
    operation: string,
    duration: number,
    recordsProcessed?: number,
    additionalMetrics?: any
  ) {
    this.info('performance', `Performance: ${operation}`, {
      duration,
      recordsProcessed,
      ...additionalMetrics
    });
  }

  public logDatabaseOperation(
    operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert',
    table: string,
    recordCount?: number,
    duration?: number,
    error?: any
  ) {
    if (error) {
      this.error('database', `Database error in ${operation} on ${table}`, error);
    } else {
      this.debug('database', `Database ${operation} on ${table}`, {
        recordCount,
        duration
      });
    }
  }

  public logUserAction(
    action: string,
    userId: string,
    resourceId?: string,
    details?: any
  ) {
    this.info('user_action', `User action: ${action}`, {
      action,
      resourceId,
      ...details
    }, { userId });
  }

  // Utility methods
  public getLogs(level?: LogLevel, category?: string, limit = 100): LogEntry[] {
    let filtered = this.logBuffer;

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (category) {
      filtered = filtered.filter(log => log.category === category);
    }

    return filtered.slice(-limit);
  }

  public getSecurityLogs(): LogEntry[] {
    return this.getLogs('security');
  }

  public getErrorLogs(): LogEntry[] {
    return this.getLogs('error');
  }

  public exportLogs(): string {
    return JSON.stringify(this.logBuffer, null, 2);
  }

  public clearLogs() {
    this.logBuffer = [];
  }
}

// Export singleton instance
export const logger = QAttendLogger.getInstance();

// Export convenience functions
export const logAttendance = (
  operation: string,
  classId: string,
  userId: string,
  sessionId?: string,
  data?: any
) => logger.logAttendanceOperation(operation as any, classId, userId, sessionId, data);

export const logSecurity = (event: string, details: any, context?: any) => 
  logger.logSecurityEvent(event as any, details, context);

export const logPerformance = (operation: string, duration: number, records?: number) => 
  logger.logPerformance(operation, duration, records);

export const logError = (category: string, message: string, error?: any, context?: any) => 
  logger.error(category, message, error, context);

export const logInfo = (category: string, message: string, data?: any, context?: any) => 
  logger.info(category, message, data, context);