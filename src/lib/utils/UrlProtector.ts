/**
 * URLProtector
 *
 * テキスト内のURLを検出し、プレースホルダーに置き換えて保護します。
 * テキストセグメンテーション後、プレースホルダーをURLリンクに復元します。
 */

export interface UrlProtectionResult {
  text: string;
  urls: string[];
}

export interface UrlInfo {
  domain: string;
  url: string;
}

export class UrlProtector {
  private static readonly PLACEHOLDER_PATTERN = /__URL_(\d+)__/g;
  private static readonly PLACEHOLDER_SINGLE = /__URL_(\d+)__/;
  private static readonly URL_PATTERN = /(https?:\/\/[^\s\u3000]+|www\.[^\s\u3000]+)/g;

  /**
   * テキスト内のURLを抽出してプレースホルダーに置き換える
   */
  protect(text: string): UrlProtectionResult {
    const urls: string[] = [];
    const processedText = text.replace(UrlProtector.URL_PATTERN, (match) => {
      const index = urls.length;
      urls.push(match);
      return `__URL_${index}__`;
    });

    return { text: processedText, urls };
  }

  /**
   * 分割されたプレースホルダーを結合する
   *
   * TinySegmenterなどが "__URL_0__" を ["__", "URL_", "0_", "__"] のように
   * 分割してしまった場合に、元のプレースホルダーに復元します。
   *
   * @param tokens セグメンテーション後のトークン配列
   * @returns 結合されたトークン配列
   */
  mergeFragmentedPlaceholders(tokens: string[]): string[] {
    const merged: string[] = [];
    let i = 0;

    while (i < tokens.length) {
      const token = tokens[i].trim();

      // プレースホルダーの一部を検出（_, __, URL, 数字のいずれかを含む）
      if (this.mightBePartOfPlaceholder(token)) {
        // 前後のトークンも含めて結合を試みる
        const startIdx = Math.max(0, i - 2); // 2つ前から
        let placeholder = '';
        let j = startIdx;
        const maxLookAhead = 20;

        // 前後のトークンを結合してプレースホルダーを探す
        while (j < tokens.length && j < startIdx + maxLookAhead) {
          placeholder += tokens[j].trim();

          // 完全なプレースホルダーが見つかったかチェック
          const match = placeholder.match(UrlProtector.PLACEHOLDER_SINGLE);
          if (match) {
            const fullPlaceholder = match[0];
            const beforeMatch = placeholder.substring(0, match.index!);
            const afterMatch = placeholder.substring(match.index! + fullPlaceholder.length);

            // マッチ前の部分を追加
            if (beforeMatch.trim()) {
              merged.push(beforeMatch.trim());
            }

            // プレースホルダーを追加
            merged.push(fullPlaceholder);

            // 後の部分があればtokens配列に戻す
            if (afterMatch.trim()) {
              tokens.splice(j + 1, 0, afterMatch.trim());
            }

            // 使用したトークンをスキップ
            i = j + 1;
            break;
          }

          j++;
        }

        // プレースホルダーが見つかった場合は次へ
        if (placeholder.match(UrlProtector.PLACEHOLDER_SINGLE)) {
          continue;
        }
      }

      // 通常のトークンとして追加
      if (token.length > 0) {
        merged.push(token);
      }
      i++;
    }

    return merged;
  }

  /**
   * トークンがプレースホルダーの一部である可能性があるかチェック
   */
  private mightBePartOfPlaceholder(token: string): boolean {
    return token.includes('_') ||
           token.includes('URL') ||
           /^\d+$/.test(token);
  }

  /**
   * プレースホルダーを元のURLに復元
   *
   * @param placeholder プレースホルダー文字列（例: "__URL_0__"）
   * @param urls URL配列
   * @returns ドメインとURL
   */
  restore(placeholder: string, urls: string[]): UrlInfo {
    const match = placeholder.match(UrlProtector.PLACEHOLDER_SINGLE);
    if (!match) {
      throw new Error(`Invalid placeholder: ${placeholder}`);
    }

    const index = parseInt(match[1]);
    const url = urls[index];
    const domain = this.extractDomain(url);

    return { domain, url };
  }

  /**
   * URLからドメインを抽出
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
      return urlObj.hostname.replace('www.', '');
    } catch (e) {
      console.warn('URL parse failed:', url, e);
      return url;
    }
  }

  /**
   * プレースホルダーをURLリンク形式に変換
   *
   * @param placeholder プレースホルダー文字列
   * @param urls URL配列
   * @returns [🔗domain](url) 形式の文字列
   */
  toUrlLink(placeholder: string, urls: string[]): string {
    const { domain, url } = this.restore(placeholder, urls);
    return `[🔗${domain}](${url})`;
  }

  /**
   * テキストがURLリンク形式かチェック
   *
   * @param text チェックするテキスト
   * @returns URLリンク情報、またはnull
   */
  parseUrlLink(text: string): UrlInfo | null {
    const urlMatch = text.match(/^\[🔗(.+?)\]\((.+?)\)$/);
    if (urlMatch) {
      return {
        domain: urlMatch[1],
        url: urlMatch[2]
      };
    }
    return null;
  }

  /**
   * トークンがプレースホルダーかチェック
   */
  isPlaceholder(token: string): boolean {
    return UrlProtector.PLACEHOLDER_SINGLE.test(token);
  }
}

// シングルトンインスタンスをエクスポート
export const urlProtector = new UrlProtector();
