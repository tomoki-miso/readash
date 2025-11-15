/**
 * アプリケーション定数
 */

/**
 * 言語検出の閾値
 */
export const LANGUAGE_DETECTION = {
  /** 日本語と判定する文字比率の閾値 */
  JAPANESE_RATIO_THRESHOLD: 0.3,
  /** 混在言語と判定する文字比率の閾値 */
  MIXED_RATIO_THRESHOLD: 0.1,
} as const;

/**
 * テキストセグメンテーション設定
 */
export const SEGMENTATION = {
  /** プレースホルダー検出時の後方参照トークン数 */
  URL_LOOKBEHIND: 2,
  /** プレースホルダー検出時の前方参照トークン数 */
  URL_LOOKAHEAD: 20,
  /** 短い引用文と判定する文字数 */
  SHORT_QUOTE_LENGTH: 12,
  /** 日付パターン検出時の最大トークン数 */
  MAX_DATE_TOKENS: 10,
  /** 数字として扱う最大桁数 */
  MAX_NUMBER_DIGITS: 4,
  /** テキストとして抽出する最小文字数 */
  MIN_TEXT_LENGTH: 20,
} as const;

/**
 * UI表示設定
 */
export const UI = {
  /** 単語間の gap サイズ（px） */
  WORD_GAP: 40,
  /** 前後の単語の画像サイズ */
  IMAGE_SIZE_CONTEXT: {
    maxWidth: '40vw',
    maxHeight: '30vh',
  },
  /** 現在の単語の画像サイズ */
  IMAGE_SIZE_CURRENT: {
    maxWidth: '80vw',
    maxHeight: '60vh',
  },
  /** 前後の単語の不透明度 */
  OPACITY_CONTEXT: 0.3,
  /** フェードアニメーション時間（ms） */
  ANIMATION_DURATION: 200,
  /** 進捗表示の位置 */
  PROGRESS_TOP: 20,
} as const;

/**
 * デフォルト設定値
 */
export interface Settings {
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  showImageIndicators: boolean;
  maxWordsPerPhrase: number;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  fontSize: 64,
  textColor: '#FFE66D',
  backgroundColor: 'rgba(0, 0, 0, 0.95)',
  showImageIndicators: true,
  maxWordsPerPhrase: 2,
} as const;

/**
 * ローカルストレージキー
 */
export const STORAGE_KEYS = {
  SETTINGS: 'readash-settings',
} as const;

/**
 * DOM ID
 */
export const DOM_IDS = {
  OVERLAY: 'readash-speed-reading-overlay',
  WORD_DISPLAY: 'readash-word-display',
  PROGRESS: 'readash-progress',
  TEXT_SECTION: 'readash-text-section',
  SETTINGS_OVERLAY: 'readash-settings-overlay',
  TOGGLE_BUTTON: 'readash-toggle-btn',
} as const;

/**
 * CSS クラス名
 */
export const CSS_CLASSES = {
  NAV: 'nav, header, footer, aside, .nav, .navbar, .header, .footer, .sidebar, .menu, .advertisement, .ad, script, style, noscript',
} as const;

/**
 * コンテンツ抽出セレクター（優先順）
 */
export const CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.article',
  '.post-content',
  '.entry-content',
  '.content',
  '#content',
  '.main-content',
  '#main-content',
] as const;

/**
 * 文章パターン（正規表現）
 */
export const PATTERNS = {
  /** 句読点 */
  PUNCTUATION: /^[、。！？,.!?]+$/,
  /** 句読点のみで始まる */
  STARTS_WITH_PUNCTUATION: /^[、。！？,.!?」）)]/,
  /** 引用符・括弧の開始 */
  QUOTE_START: /^[「（(]/,
  /** 引用符・括弧の終了 */
  QUOTE_END: /[」）)]$/,
  /** 数字（1-4桁） */
  NUMBER: /^\d{1,4}$/,
  /** カンマ区切り数字 */
  NUMBER_WITH_COMMA: /^\d{1,3}(,\d{3})?$/,
  /** 年月日の区切り */
  DATE_SEPARATOR: /^[年月日\/\-]$/,
  /** 日付パターンの検出 */
  HAS_DATE: /[年月日\/\-]/,
  /** て形動詞 */
  TE_FORM: /[てで]$/,
  /** 補助動詞 */
  AUXILIARY_VERB: /^(いる|ある|おく|みる|しまう|くる|いく|もらう|あげる|くれる)/,
  /** 空白のみ */
  WHITESPACE_ONLY: /^\s+$/,
} as const;
