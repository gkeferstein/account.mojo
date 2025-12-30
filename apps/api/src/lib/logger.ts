/**
 * Centralized Logger
 * 
 * Provides structured logging throughout the application.
 * Uses a simple structured format that works without external dependencies.
 * In production, this can be piped to log aggregation services.
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = (process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')).toLowerCase();

/**
 * Log levels in order of severity
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

const currentLogLevel = LOG_LEVELS[logLevel as keyof typeof LOG_LEVELS] ?? LOG_LEVELS.info;

/**
 * Format log entry with timestamp and structured data
 */
function formatLog(level: string, message: string, meta?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

/**
 * Logger interface for consistent usage
 */
export interface AppLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Simple structured logger that can be used in any context
 * Matches Fastify's request.log interface pattern
 */
export const appLogger: AppLogger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    if (currentLogLevel >= LOG_LEVELS.info) {
      if (isDevelopment) {
        console.log(formatLog('info', message, meta));
      } else {
        // In production, output JSON for log aggregation
        console.log(JSON.stringify({
          level: 'info',
          time: new Date().toISOString(),
          msg: message,
          ...meta,
        }));
      }
    }
  },
  
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (currentLogLevel >= LOG_LEVELS.warn) {
      if (isDevelopment) {
        console.warn(formatLog('warn', message, meta));
      } else {
        console.warn(JSON.stringify({
          level: 'warn',
          time: new Date().toISOString(),
          msg: message,
          ...meta,
        }));
      }
    }
  },
  
  error: (message: string, meta?: Record<string, unknown>) => {
    if (currentLogLevel >= LOG_LEVELS.error) {
      // Always log errors
      if (isDevelopment) {
        console.error(formatLog('error', message, meta));
      } else {
        console.error(JSON.stringify({
          level: 'error',
          time: new Date().toISOString(),
          msg: message,
          ...meta,
        }));
      }
    }
  },
  
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (currentLogLevel >= LOG_LEVELS.debug && isDevelopment) {
      console.debug(formatLog('debug', message, meta));
    }
  },
};

export default appLogger;

