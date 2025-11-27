// ============================================
// LOGGER UTILITY
// ============================================

export class Logger {
  private static instance: Logger;
  private prefix: string;

  constructor(prefix = 'WhatsApp AI') {
    this.prefix = prefix;
  }

  static getInstance(prefix?: string): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(prefix);
    }
    return Logger.instance;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.prefix}] ${message}`;
  }

  info(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage('INFO', message), ...args);
  }

  error(message: string, error?: unknown): void {
    console.error(this.formatMessage('ERROR', message), error);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage('WARN', message), ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('DEBUG', message), ...args);
    }
  }

  success(message: string, ...args: unknown[]): void {
    console.log(this.formatMessage('✓ SUCCESS', message), ...args);
  }
}

export const logger = Logger.getInstance();

