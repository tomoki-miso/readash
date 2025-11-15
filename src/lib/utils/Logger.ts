/**
 * Logger
 *
 * 開発環境でのみログを出力するロガーユーティリティ
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private enabled: boolean;
  private minLevel: LogLevel;

  constructor() {
    // 開発環境でのみログを有効化
    this.enabled = import.meta.env.DEV;
    this.minLevel = LogLevel.DEBUG;
  }

  /**
   * ログを有効/無効にする
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 最小ログレベルを設定
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * デバッグログ
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * 情報ログ
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * 警告ログ
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  /**
   * エラーログ
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  /**
   * グループ開始
   */
  group(label: string): void {
    if (this.enabled) {
      console.group(label);
    }
  }

  /**
   * グループ終了
   */
  groupEnd(): void {
    if (this.enabled) {
      console.groupEnd();
    }
  }

  /**
   * ログを出力すべきかチェック
   */
  private shouldLog(level: LogLevel): boolean {
    return this.enabled && level >= this.minLevel;
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();
