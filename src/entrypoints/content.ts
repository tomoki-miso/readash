import TinySegmenter from 'tiny-segmenter';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('Text reader extension loaded');

    // グローバル状態
    let speedReadingActive = false;
    let currentWordIndex = 0;
    let words: string[] = [];
    let imageData: Map<number, { url: string; alt: string; caption?: string }[]> = new Map();

    // 設定
    interface Settings {
      fontSize: number;
      textColor: string;
      backgroundColor: string;
      showImageIndicators: boolean;
      maxWordsPerPhrase: number;
    }

    let settings: Settings = {
      fontSize: 64,
      textColor: '#FFE66D',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      showImageIndicators: true,
      maxWordsPerPhrase: 2
    };

    // 言語を検出
    function detectLanguage(text: string): 'ja' | 'en' | 'mixed' {
      // 日本語文字（ひらがな、カタカナ、漢字）の割合を計算
      const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];
      const totalChars = text.replace(/\s/g, '').length;
      const japaneseRatio = japaneseChars.length / totalChars;

      if (japaneseRatio > 0.3) {
        return 'ja';
      } else if (japaneseRatio > 0.1) {
        return 'mixed';
      } else {
        return 'en';
      }
    }

    // 日本語テキストをフレーズ単位で分割（改善版）
    function segmentJapanese(text: string): string[] {
      // URLを先に抽出して保護
      const urlPattern = /(https?:\/\/[^\s\u3000]+|www\.[^\s\u3000]+)/g;
      const urls: string[] = [];
      let processedText = text.replace(urlPattern, (match) => {
        const index = urls.length;
        urls.push(match);
        return `__URL_${index}__`;
      });

      const segmenter = new TinySegmenter();
      let words = segmenter.segment(processedText);

      // URLプレースホルダーが分割されている場合は結合（改善版）
      // 全単語を結合して再度プレースホルダーを探す方式に変更
      const mergedWords: string[] = [];
      let i = 0;
      while (i < words.length) {
        let word = words[i].trim();

        // プレースホルダーの一部を検出（より広範囲に）
        // _, __, URL, 数字のいずれかを含む場合にチェック
        if (word.includes('_') || word.includes('URL') || /^\d+$/.test(word)) {
          // 前後の単語も含めて結合を試みる
          let startIdx = Math.max(0, i - 2); // 2つ前から
          let placeholder = '';
          let j = startIdx;
          let maxLookAhead = 20;

          // 前後の単語を結合してプレースホルダーを探す
          while (j < words.length && j < startIdx + maxLookAhead) {
            placeholder += words[j].trim();

            // 完全なプレースホルダーが見つかったかチェック
            const match = placeholder.match(/__URL_\d+__/);
            if (match) {
              const fullPlaceholder = match[0];
              const beforeMatch = placeholder.substring(0, match.index);
              const afterMatch = placeholder.substring(match.index! + fullPlaceholder.length);

              console.log('Found and merged URL placeholder:', fullPlaceholder);

              // マッチ前の部分を追加
              if (beforeMatch) {
                const beforeWords = beforeMatch.split(/\s+/).filter(w => w);
                mergedWords.push(...beforeWords);
              }

              // プレースホルダーを追加
              mergedWords.push(fullPlaceholder);

              // 後の部分は words に戻す
              if (afterMatch.trim()) {
                words.splice(j + 1, 0, afterMatch.trim());
              }

              // 使用した単語をスキップ
              i = j + 1;

              // 次のループへ
              break;
            }

            j++;
          }

          // プレースホルダーが見つかった場合は次へ
          if (placeholder.match(/__URL_\d+__/)) {
            continue;
          }
        }

        mergedWords.push(word);
        i++;
      }

      words = mergedWords.filter(w => w.length > 0);
      console.log('After merging placeholders:', words);

      // より自然なフレーズを作成
      const result: string[] = [];
      let buffer = '';
      let wordCount = 0;

      // 引用符・括弧で囲まれた短いテキストを検出してまとめる
      let inQuote = false;
      let quoteBuffer = '';
      let quoteWords: string[] = [];

      for (let idx = 0; idx < words.length; idx++) {
        const word = words[idx];
        const nextWord = idx < words.length - 1 ? words[idx + 1] : '';

        // 空白のみの場合はスキップ
        if (/^\s+$/.test(word)) {
          continue;
        }

        // URLプレースホルダーを検出
        console.log('Checking word for URL placeholder:', word);
        const urlPlaceholder = word.match(/__URL_(\d+)__/);
        if (urlPlaceholder) {
          console.log('✓ Found URL placeholder match:', urlPlaceholder);
          // 現在のバッファを追加
          if (buffer) {
            result.push(buffer);
            buffer = '';
            wordCount = 0;
          }

          // URLを復元してドメインを抽出
          const url = urls[parseInt(urlPlaceholder[1])];
          console.log('Restoring URL from placeholder:', url);
          let domain = url;
          try {
            const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
            domain = urlObj.hostname.replace('www.', '');
          } catch (e) {
            // URLパース失敗時はそのまま使用
            console.warn('URL parse failed:', url, e);
          }

          // URL全体を保存（クリック可能にするため）
          const urlLink = `[🔗${domain}](${url})`;
          console.log('Created URL link:', urlLink);
          result.push(urlLink);
          continue;
        } else if (word.includes('URL') || word.includes('__')) {
          console.log('✗ Word contains URL/__ but does not match pattern:', word);
        }

        // 引用符・括弧の開始を検出
        if (/^[「（(]/.test(word)) {
          inQuote = true;
          quoteBuffer = word;
          quoteWords = [word];
          continue;
        }

        // 引用符・括弧内の場合
        if (inQuote) {
          quoteBuffer += word;
          quoteWords.push(word);

          // 引用符・括弧の終了を検出
          if (/[」）)]$/.test(word)) {
            inQuote = false;

            // 短い引用（10文字以内）の場合はそのまま追加
            if (quoteBuffer.length <= 12) {
              buffer += quoteBuffer;
              wordCount++;
              quoteBuffer = '';
              quoteWords = [];
              continue;
            } else {
              // 長い引用は分割して処理
              for (const qWord of quoteWords) {
                buffer += qWord;
                if (!/^[、。！？,.!?「」（）()]$/.test(qWord)) {
                  wordCount++;
                }

                // 句読点で区切る
                if (/[、。！？]/.test(qWord) && wordCount > 0) {
                  result.push(buffer);
                  buffer = '';
                  wordCount = 0;
                } else if (wordCount >= settings.maxWordsPerPhrase) {
                  result.push(buffer);
                  buffer = '';
                  wordCount = 0;
                }
              }
              quoteBuffer = '';
              quoteWords = [];
            }
          }
          continue;
        }

        // 日付を1つのまとまりとして扱う
        // パターン: 2024年11月15日、11月15日、2024/11/15、など
        if (/^\d{1,4}$/.test(word)) {
          let dateBuffer = word;
          let j = i + 1;
          let isDate = false;

          // 年月日のパターンをチェック
          while (j < words.length && j < i + 10) { // 最大10トークン先まで
            const next = words[j];

            // 年月日、/, -, などの区切り文字
            if (/^[年月日\/\-]$/.test(next) || /^\d{1,4}$/.test(next)) {
              dateBuffer += next;
              j++;

              // 日付パターンを検出
              if (/年/.test(next) || /月/.test(next) || /日/.test(next)) {
                isDate = true;
              }
              if (/\//.test(next) || /\-/.test(next)) {
                isDate = true;
              }
            } else {
              break;
            }
          }

          // 日付として検出された場合
          if (isDate && dateBuffer.length > word.length) {
            buffer += dateBuffer;
            wordCount++;
            i = j - 1;

            if (wordCount >= settings.maxWordsPerPhrase) {
              result.push(buffer);
              buffer = '';
              wordCount = 0;
            }
            continue;
          }
        }

        // 数字（4桁以内）を1つのまとまりとして扱う
        if (/^\d{1,4}$/.test(word) || /^\d{1,3}(,\d{3})?$/.test(word)) {
          // 次の単語も数字の場合は結合を試みる
          let numberBuffer = word;
          let j = i + 1;
          while (j < words.length && /^[\d,]+$/.test(words[j]) && numberBuffer.replace(/,/g, '').length <= 4) {
            numberBuffer += words[j];
            j++;
          }

          // 4桁以内なら1つのまとまりとして追加
          if (numberBuffer.replace(/,/g, '').length <= 4) {
            buffer += numberBuffer;
            wordCount++;
            i = j - 1; // ループカウンタを調整

            // 単語数チェック
            if (wordCount >= settings.maxWordsPerPhrase) {
              result.push(buffer);
              buffer = '';
              wordCount = 0;
            }
            continue;
          }
        }

        // 句読点のみの場合は、必ず前のバッファに追加してから区切る
        const isPunctuationOnly = /^[、。！？,.!?]+$/.test(word);

        if (isPunctuationOnly) {
          // バッファに内容がある場合のみ、句読点を追加して出力
          if (wordCount > 0) {
            buffer += word;
            result.push(buffer);
            buffer = '';
            wordCount = 0;
          }
          // バッファが空の場合は、句読点を無視（前のフレーズに既に含まれている）
          continue;
        }

        buffer += word;
        wordCount++;

        // て形の動詞＋補助動詞（いる、ある、おく、みる等）は結合
        const isTeForm = /[てで]$/.test(word);
        const isAuxiliaryVerb = /^(いる|ある|おく|みる|しまう|くる|いく|もらう|あげる|くれる)/.test(nextWord);

        // 区切るかどうかの判定（単語数のみで判断）
        const shouldBreak =
          // て形＋補助動詞の場合は区切らない
          !(isTeForm && isAuxiliaryVerb) &&
          // 設定された単語数に達した場合
          wordCount >= settings.maxWordsPerPhrase;

        if (shouldBreak && buffer.trim().length > 0) {
          result.push(buffer);
          buffer = '';
          wordCount = 0;
        }
      }

      // 残りのバッファを追加
      if (buffer.trim().length > 0 && !/^[、。！？,.!?]+$/.test(buffer.trim())) {
        result.push(buffer);
      }

      // 句読点で始まるフレーズを前のフレーズに結合
      const cleanedResult: string[] = [];
      for (let i = 0; i < result.length; i++) {
        const phrase = result[i];

        // 句読点で始まる場合、前のフレーズに結合
        if (/^[、。！？,.!?」）)]/.test(phrase.trim())) {
          if (cleanedResult.length > 0) {
            cleanedResult[cleanedResult.length - 1] += phrase;
          } else {
            // 最初のフレーズの場合は、そのまま追加（句読点を削除）
            cleanedResult.push(phrase.replace(/^[、。！？,.!?」）)]+/, ''));
          }
        } else {
          cleanedResult.push(phrase);
        }
      }

      return cleanedResult.filter(w => w.trim().length > 0);
    }

    // 英語テキストをフレーズ単位で分割
    function segmentEnglish(text: string): string[] {
      const phrases: string[] = [];

      // URLを先に抽出して置換
      const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
      const urls: string[] = [];
      let processedText = text.replace(urlPattern, (match) => {
        const index = urls.length;
        urls.push(match);
        return `__URL_${index}__`;
      });

      // 句点（.!?）または読点（,;:）で分割
      let parts = processedText.split(/([.!?]|[,;:](?=\s))/);

      // URLプレースホルダーが分割されている場合は結合（改善版）
      const mergedParts: string[] = [];
      let i = 0;
      while (i < parts.length) {
        let part = parts[i];

        // プレースホルダーの一部を検出（より広範囲に）
        if (part && (part.includes('_') || part.includes('URL') || /\d/.test(part))) {
          // 前後の部分も含めて結合を試みる
          let startIdx = Math.max(0, i - 2);
          let placeholder = '';
          let j = startIdx;
          let maxLookAhead = 20;

          // 前後の部分を結合してプレースホルダーを探す
          while (j < parts.length && j < startIdx + maxLookAhead) {
            placeholder += parts[j];

            // 完全なプレースホルダーが見つかったかチェック
            const match = placeholder.match(/__URL_\d+__/);
            if (match) {
              const fullPlaceholder = match[0];
              const beforeMatch = placeholder.substring(0, match.index);
              const afterMatch = placeholder.substring(match.index! + fullPlaceholder.length);

              console.log('Found and merged URL placeholder (English):', fullPlaceholder);

              // マッチ前の部分を追加
              if (beforeMatch.trim()) {
                mergedParts.push(beforeMatch);
              }

              // プレースホルダーを追加
              mergedParts.push(fullPlaceholder);

              // 後の部分は parts に戻す
              if (afterMatch.trim()) {
                parts.splice(j + 1, 0, afterMatch);
              }

              // 使用した部分をスキップ
              i = j + 1;
              break;
            }

            j++;
          }

          // プレースホルダーが見つかった場合は次へ
          if (placeholder.match(/__URL_\d+__/)) {
            continue;
          }
        }

        if (part) {
          mergedParts.push(part);
        }
        i++;
      }

      parts = mergedParts;

      let buffer = '';
      let wordCount = 0;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part || !part.trim()) continue;

        // URLプレースホルダーを検出
        const urlPlaceholder = part.match(/__URL_(\d+)__/);
        if (urlPlaceholder) {
          // 現在のバッファを追加
          if (buffer.trim()) {
            phrases.push(buffer.trim());
            buffer = '';
            wordCount = 0;
          }

          // URLを復元してドメインを抽出
          const url = urls[parseInt(urlPlaceholder[1])];
          let domain = url;
          try {
            const urlObj = new URL(url.startsWith('http') ? url : 'https://' + url);
            domain = urlObj.hostname.replace('www.', '');
          } catch (e) {
            // URLパース失敗時はそのまま使用
          }

          phrases.push(`[🔗${domain}](${url})`);
          continue;
        }

        buffer += part;

        // 単語数をカウント（句読点以外）
        if (!/^[.!?,;:]+$/.test(part)) {
          const words = part.trim().split(/\s+/).length;
          wordCount += words;
        }

        // 区切り条件
        const shouldBreak =
          /[.!?]/.test(part) || // 句点で区切る
          (/[,;:]/.test(part) && wordCount >= 1) || // 読点で区切る
          wordCount >= settings.maxWordsPerPhrase; // 設定された最大単語数

        if (shouldBreak && buffer.trim().length > 0) {
          // 句読点のみのフレーズは除外
          if (!/^[.!?,;:]+$/.test(buffer.trim())) {
            phrases.push(buffer.trim());
          }
          buffer = '';
          wordCount = 0;
        }
      }

      if (buffer.trim().length > 0 && !/^[.!?,;:]+$/.test(buffer.trim())) {
        phrases.push(buffer.trim());
      }

      return phrases.filter(p => p.length > 0);
    }

    // テキストを単語に分割（改善版）
    function segmentText(text: string): string[] {
      const language = detectLanguage(text);
      console.log('Detected language:', language);

      if (language === 'ja') {
        return segmentJapanese(text);
      } else if (language === 'en') {
        return segmentEnglish(text);
      } else {
        // 混在テキストの場合は文を分割して処理
        const sentences = text.split(/([。.！!？?])/);
        const allWords: string[] = [];

        for (const sentence of sentences) {
          if (!sentence.trim()) continue;

          const sentenceLang = detectLanguage(sentence);
          if (sentenceLang === 'ja') {
            allWords.push(...segmentJapanese(sentence));
          } else {
            allWords.push(...segmentEnglish(sentence));
          }
        }

        return allWords;
      }
    }

    // ページから本文のみを抽出（画像も含む）
    function extractPageText(): { texts: string[]; images: Map<number, { url: string; alt: string; caption?: string }[]> } {
      const texts: string[] = [];
      const images: Map<number, { url: string; alt: string; caption?: string }[]> = new Map();
      let textIndex = 0;

      // 除外する要素のセレクター
      const excludeSelectors = 'nav, header, footer, aside, .nav, .navbar, .header, .footer, .sidebar, .menu, .advertisement, .ad, script, style, noscript';

      // 本文を含む可能性が高い要素を優先的に検索
      let mainContent: Element | null = null;

      // まずarticle, main, [role="main"]などから本文を探す
      const contentSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.article',
        '.post-content',
        '.entry-content',
        '.content',
        '#content',
        '.main-content',
        '#main-content'
      ];

      for (const selector of contentSelectors) {
        mainContent = document.querySelector(selector);
        if (mainContent) {
          console.log('Main content found:', selector);
          break;
        }
      }

      // 本文エリアが見つからない場合はbodyを使用
      if (!mainContent) {
        mainContent = document.body;
      }

      // 本文エリア内の全要素を順番に走査
      const allElements = mainContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, img, figure');

      allElements.forEach(element => {
        // 除外要素の子孫かチェック
        if (element.closest(excludeSelectors)) {
          return;
        }

        // 画像要素の場合
        if (element.tagName === 'IMG') {
          const img = element as HTMLImageElement;
          const imageUrl = img.src || img.dataset.src;
          if (imageUrl && !imageUrl.startsWith('data:')) {
            const imageInfo = {
              url: imageUrl,
              alt: img.alt || '',
              caption: img.title || undefined
            };

            // 現在のテキストインデックスに画像を関連付け
            if (!images.has(textIndex)) {
              images.set(textIndex, []);
            }
            images.get(textIndex)!.push(imageInfo);
          }
          return;
        }

        // figure要素の場合（画像+キャプション）
        if (element.tagName === 'FIGURE') {
          const img = element.querySelector('img') as HTMLImageElement | null;
          const figcaption = element.querySelector('figcaption');

          if (img) {
            const imageUrl = img.src || img.dataset.src;
            if (imageUrl && !imageUrl.startsWith('data:')) {
              const imageInfo = {
                url: imageUrl,
                alt: img.alt || '',
                caption: figcaption?.textContent?.trim() || img.title || undefined
              };

              if (!images.has(textIndex)) {
                images.set(textIndex, []);
              }
              images.get(textIndex)!.push(imageInfo);
            }
          }
          return;
        }

        // テキスト要素の場合
        const text = element.textContent?.trim();
        // 最低限の長さでフィルタリング（ナビゲーションリンクなどを除外）
        if (text && text.length > 20) {
          texts.push(text);
          textIndex++;
        }
      });

      return { texts, images };
    }

    // 速読モードのオーバーレイを作成
    function createSpeedReadingOverlay() {
      const overlay = document.createElement('div');
      overlay.id = 'readash-speed-reading-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: ${settings.backgroundColor};
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: system-ui, -apple-system, sans-serif;
        gap: 40px;
      `;

      // 進行状況表示
      const progressBar = document.createElement('div');
      progressBar.id = 'readash-progress';
      progressBar.style.cssText = `
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: rgba(255, 255, 255, 0.7);
        font-size: 16px;
      `;
      overlay.appendChild(progressBar);

      // テキスト表示エリア（上部・中央）
      const textSection = document.createElement('div');
      textSection.id = 'readash-text-section';
      textSection.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        max-height: 85vh;
        overflow-y: auto;
        overflow-x: hidden;
        width: 100%;
        padding: 20px;
      `;

      // 単語表示エリア（カラオケスタイル - 縦配置）
      const wordDisplay = document.createElement('div');
      wordDisplay.id = 'readash-word-display';
      wordDisplay.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 30px;
        font-size: ${settings.fontSize}px;
        font-weight: bold;
        text-align: center;
        line-height: 1.4;
        width: 100%;
      `;
      textSection.appendChild(wordDisplay);
      overlay.appendChild(textSection);


      // 操作ガイド
      const guide = document.createElement('div');
      guide.style.cssText = `
        position: absolute;
        bottom: 40px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 14px;
        text-align: center;
      `;
      guide.innerHTML = `
        <div style="margin-bottom: 10px;">スペース / 右矢印: 次へ　|　左矢印: 戻る　|　ESC: 終了</div>
      `;
      overlay.appendChild(guide);

      // スクロールバーのカスタムスタイル
      const style = document.createElement('style');
      style.textContent = `
        #readash-text-section::-webkit-scrollbar {
          width: 10px;
        }
        #readash-text-section::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 5px;
        }
        #readash-text-section::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 5px;
        }
        #readash-text-section::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `;
      overlay.appendChild(style);

      return overlay;
    }

    // URLリンク形式のテキストを処理
    function parseUrlText(text: string): { isUrl: boolean; domain?: string; url?: string } {
      // 詳細なデバッグログ
      console.log('=== parseUrlText Debug ===');
      console.log('Input text:', text);
      console.log('Text length:', text.length);
      console.log('Character codes:', Array.from(text).map((c, i) => `${i}:${c}(${c.charCodeAt(0)})`).join(', '));
      console.log('Starts with [:', text.startsWith('['));
      console.log('Contains 🔗:', text.includes('🔗'));

      const urlMatch = text.match(/^\[🔗(.+?)\]\((.+?)\)$/);
      console.log('Regex match result:', urlMatch);

      if (urlMatch) {
        console.log('Match groups - domain:', urlMatch[1], 'url:', urlMatch[2]);
        return {
          isUrl: true,
          domain: urlMatch[1],
          url: urlMatch[2]
        };
      }
      console.log('No match - returning isUrl: false');
      return { isUrl: false };
    }

    // URLリンク要素を作成
    function createUrlElement(domain: string, url: string, styleText: string): HTMLElement {
      const link = document.createElement('a');
      link.textContent = `🔗${domain}`;
      link.href = '#';
      link.style.cssText = styleText + `
        cursor: pointer;
        text-decoration: underline;
      `;
      link.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(url.startsWith('http') ? url : 'https://' + url, '_blank');
      };
      return link;
    }

    // 現在の単語を表示（カラオケスタイル）
    function displayCurrentWord() {
      const wordDisplay = document.getElementById('readash-word-display');
      const progressBar = document.getElementById('readash-progress');

      if (!wordDisplay || !progressBar || words.length === 0) return;

      // 単語表示をクリア
      wordDisplay.innerHTML = '';

      // 前の単語（薄く表示）+ 画像インジケーター
      if (currentWordIndex > 0) {
        const prevContainer = document.createElement('div');
        prevContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        `;

        // 前の単語がURLかチェック
        const prevWordText = words[currentWordIndex - 1];
        const prevUrlInfo = parseUrlText(prevWordText);
        let prevWordElement: HTMLElement;

        if (prevUrlInfo.isUrl && prevUrlInfo.domain && prevUrlInfo.url) {
          // URLの場合はクリック可能なリンクとして表示
          prevWordElement = createUrlElement(
            prevUrlInfo.domain,
            prevUrlInfo.url,
            `
              color: rgba(255, 255, 255, 0.3);
              font-size: 0.6em;
            `
          );
        } else {
          // 通常のテキスト
          prevWordElement = document.createElement('span');
          prevWordElement.textContent = prevWordText;
          prevWordElement.style.cssText = `
            color: rgba(255, 255, 255, 0.3);
            font-size: 0.6em;
          `;
        }
        prevContainer.appendChild(prevWordElement);

        // 前のフレーズに画像がある場合
        if (settings.showImageIndicators && imageData.has(currentWordIndex - 1)) {
          const images = imageData.get(currentWordIndex - 1)!;
          for (const imageInfo of images) {
            const img = document.createElement('img');
            img.src = imageInfo.url;
            img.alt = imageInfo.alt;
            img.style.cssText = `
              max-width: 40vw;
              max-height: 30vh;
              object-fit: contain;
              opacity: 0.3;
              margin-top: 10px;
              border-radius: 4px;
            `;
            prevContainer.appendChild(img);
          }
        }

        wordDisplay.appendChild(prevContainer);
      }

      // 現在の単語（ハイライト）
      const currentWordText = words[currentWordIndex];
      console.log('Current word:', currentWordText);
      const urlInfo = parseUrlText(currentWordText);
      console.log('Parsed URL info:', urlInfo);
      let currentWord: HTMLElement;

      if (urlInfo.isUrl && urlInfo.domain && urlInfo.url) {
        console.log('Creating URL element:', urlInfo.domain, urlInfo.url);
        currentWord = createUrlElement(
          urlInfo.domain,
          urlInfo.url,
          `
            color: ${settings.textColor};
            text-shadow: 0 0 20px ${settings.textColor}80;
            font-size: 1em;
            animation: pulse 0.3s ease-in-out;
          `
        );
      } else {
        currentWord = document.createElement('span');
        currentWord.textContent = currentWordText;
        currentWord.style.cssText = `
          color: ${settings.textColor};
          text-shadow: 0 0 20px ${settings.textColor}80;
          font-size: 1em;
          animation: pulse 0.3s ease-in-out;
        `;
      }
      wordDisplay.appendChild(currentWord);

      // 現在のフレーズに画像がある場合は実際の画像を表示
      if (settings.showImageIndicators && imageData.has(currentWordIndex)) {
        const images = imageData.get(currentWordIndex)!;
        for (const imageInfo of images) {
          const img = document.createElement('img');
          img.src = imageInfo.url;
          img.alt = imageInfo.alt;
          img.style.cssText = `
            max-width: 80vw;
            max-height: 60vh;
            object-fit: contain;
            margin-top: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          `;
          wordDisplay.appendChild(img);
        }
      }

      // 次の単語（薄く表示）+ 画像インジケーター
      if (currentWordIndex < words.length - 1) {
        const nextContainer = document.createElement('div');
        nextContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        `;

        // 次の単語がURLかチェック
        const nextWordText = words[currentWordIndex + 1];
        const nextUrlInfo = parseUrlText(nextWordText);
        let nextWordElement: HTMLElement;

        if (nextUrlInfo.isUrl && nextUrlInfo.domain && nextUrlInfo.url) {
          // URLの場合はクリック可能なリンクとして表示
          nextWordElement = createUrlElement(
            nextUrlInfo.domain,
            nextUrlInfo.url,
            `
              color: rgba(255, 255, 255, 0.3);
              font-size: 0.6em;
            `
          );
        } else {
          // 通常のテキスト
          nextWordElement = document.createElement('span');
          nextWordElement.textContent = nextWordText;
          nextWordElement.style.cssText = `
            color: rgba(255, 255, 255, 0.3);
            font-size: 0.6em;
          `;
        }
        nextContainer.appendChild(nextWordElement);

        // 次のフレーズに画像がある場合
        if (settings.showImageIndicators && imageData.has(currentWordIndex + 1)) {
          const images = imageData.get(currentWordIndex + 1)!;
          for (const imageInfo of images) {
            const img = document.createElement('img');
            img.src = imageInfo.url;
            img.alt = imageInfo.alt;
            img.style.cssText = `
              max-width: 40vw;
              max-height: 30vh;
              object-fit: contain;
              opacity: 0.3;
              margin-top: 10px;
              border-radius: 4px;
            `;
            nextContainer.appendChild(img);
          }
        }

        wordDisplay.appendChild(nextContainer);
      }


      // 進行状況を更新
      progressBar.textContent = `${currentWordIndex + 1} / ${words.length}`;

      // アニメーション効果
      wordDisplay.style.opacity = '0';
      setTimeout(() => {
        wordDisplay.style.transition = 'opacity 0.2s';
        wordDisplay.style.opacity = '1';
      }, 10);
    }

    // 速読モードを開始
    function startSpeedReading() {
      // 既にアクティブな場合は終了
      if (speedReadingActive) {
        stopSpeedReading();
        return;
      }

      // テキストと画像を抽出
      const { texts, images: extractedImages } = extractPageText();
      if (texts.length === 0) {
        alert('読み込めるテキストが見つかりませんでした');
        return;
      }

      // 全テキストを結合して単語に分割
      const fullText = texts.join(' ');
      words = segmentText(fullText);

      if (words.length === 0) {
        alert('単語が見つかりませんでした');
        return;
      }

      // 画像をフレーズインデックスにマッピング
      imageData.clear();

      // 各テキストセグメントに対応するフレーズ範囲を計算
      let phraseIndex = 0;
      for (let textIndex = 0; textIndex < texts.length; textIndex++) {
        const text = texts[textIndex];
        const phrases = segmentText(text);

        // このテキストセグメントに画像がある場合
        if (extractedImages.has(textIndex)) {
          const imgs = extractedImages.get(textIndex)!;
          // そのテキストセグメントの最初のフレーズに画像を関連付け
          imageData.set(phraseIndex, imgs);
          console.log(`Image mapped to phrase ${phraseIndex}:`, imgs);
        }

        phraseIndex += phrases.length;
      }

      console.log(`Speed reading started with ${words.length} phrases and ${imageData.size} images`);

      // オーバーレイを作成
      const overlay = createSpeedReadingOverlay();
      document.body.appendChild(overlay);

      speedReadingActive = true;
      currentWordIndex = 0;

      // 最初の単語を表示
      displayCurrentWord();
    }

    // 速読モードを終了
    function stopSpeedReading() {
      const overlay = document.getElementById('readash-speed-reading-overlay');
      if (overlay) {
        overlay.remove();
      }
      speedReadingActive = false;
      currentWordIndex = 0;
      words = [];
      imageData.clear();
    }

    // 設定を保存
    function saveSettings() {
      localStorage.setItem('readash-settings', JSON.stringify(settings));
    }

    // 設定を読み込み
    function loadSettings() {
      const saved = localStorage.getItem('readash-settings');
      if (saved) {
        try {
          settings = { ...settings, ...JSON.parse(saved) };
        } catch (e) {
          console.error('Failed to load settings:', e);
        }
      }
    }

    // 設定画面を表示
    function showSettings() {
      const settingsOverlay = document.createElement('div');
      settingsOverlay.id = 'readash-settings-overlay';
      settingsOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        z-index: 10000000;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: system-ui, -apple-system, sans-serif;
      `;

      const settingsPanel = document.createElement('div');
      settingsPanel.style.cssText = `
        background: #2a2a2a;
        border-radius: 12px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        color: white;
      `;

      settingsPanel.innerHTML = `
        <h2 style="margin: 0 0 20px 0; font-size: 24px;">設定</h2>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px;">
            フォントサイズ: <span id="fontSize-value">${settings.fontSize}</span>px
          </label>
          <input type="range" id="fontSize" min="32" max="128" value="${settings.fontSize}"
                 style="width: 100%; accent-color: #667eea;">
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px;">
            テキストカラー
          </label>
          <input type="color" id="textColor" value="${settings.textColor}"
                 style="width: 100%; height: 40px; border: none; border-radius: 4px;">
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px;">
            背景カラー
          </label>
          <input type="color" id="backgroundColor" value="${rgbaToHex(settings.backgroundColor)}"
                 style="width: 100%; height: 40px; border: none; border-radius: 4px;">
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: flex; align-items: center; font-size: 14px; cursor: pointer;">
            <input type="checkbox" id="showImageIndicators" ${settings.showImageIndicators ? 'checked' : ''}
                   style="margin-right: 8px; width: 18px; height: 18px; accent-color: #667eea;">
            画像インジケーターを表示
          </label>
        </div>

        <div style="margin-bottom: 30px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px;">
            フレーズの最大単語数: <span id="maxWords-value">${settings.maxWordsPerPhrase}</span>
          </label>
          <input type="range" id="maxWordsPerPhrase" min="1" max="5" value="${settings.maxWordsPerPhrase}"
                 style="width: 100%; accent-color: #667eea;">
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="settings-close" style="
            padding: 10px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">閉じる</button>
        </div>
      `;

      settingsOverlay.appendChild(settingsPanel);
      document.body.appendChild(settingsOverlay);

      // 設定を即時反映する関数
      const applySettings = () => {
        const overlay = document.getElementById('readash-speed-reading-overlay');
        const wordDisplay = document.getElementById('readash-word-display');

        if (overlay) {
          overlay.style.background = settings.backgroundColor;
        }
        if (wordDisplay) {
          wordDisplay.style.fontSize = `${settings.fontSize}px`;
        }

        // 表示を更新
        if (speedReadingActive) {
          displayCurrentWord();
        }

        saveSettings();
      };

      // イベントリスナー
      const fontSizeInput = document.getElementById('fontSize') as HTMLInputElement;
      const fontSizeValue = document.getElementById('fontSize-value');
      fontSizeInput?.addEventListener('input', () => {
        if (fontSizeValue) fontSizeValue.textContent = fontSizeInput.value;
        settings.fontSize = parseInt(fontSizeInput.value);
        applySettings();
      });

      const textColorInput = document.getElementById('textColor') as HTMLInputElement;
      textColorInput?.addEventListener('input', () => {
        settings.textColor = textColorInput.value;
        applySettings();
      });

      const backgroundColorInput = document.getElementById('backgroundColor') as HTMLInputElement;
      backgroundColorInput?.addEventListener('input', () => {
        settings.backgroundColor = hexToRgba(backgroundColorInput.value);
        applySettings();
      });

      const showImageIndicatorsInput = document.getElementById('showImageIndicators') as HTMLInputElement;
      showImageIndicatorsInput?.addEventListener('change', () => {
        settings.showImageIndicators = showImageIndicatorsInput.checked;
        applySettings();
      });

      const maxWordsInput = document.getElementById('maxWordsPerPhrase') as HTMLInputElement;
      const maxWordsValue = document.getElementById('maxWords-value');
      maxWordsInput?.addEventListener('input', () => {
        if (maxWordsValue) maxWordsValue.textContent = maxWordsInput.value;
        const oldValue = settings.maxWordsPerPhrase;
        settings.maxWordsPerPhrase = parseInt(maxWordsInput.value);

        // フレーズの分け方が変わった場合は、テキストを再分割
        if (speedReadingActive && oldValue !== settings.maxWordsPerPhrase) {
          const { texts } = extractPageText();
          const fullText = texts.join(' ');
          const oldIndex = currentWordIndex;
          words = segmentText(fullText);
          // なるべく近い位置に戻す
          currentWordIndex = Math.min(oldIndex, words.length - 1);
          displayCurrentWord();
        }

        applySettings();
      });

      // 閉じるボタン
      document.getElementById('settings-close')?.addEventListener('click', () => {
        settingsOverlay.remove();
      });

      // オーバーレイクリックで閉じる
      settingsOverlay.addEventListener('click', (e) => {
        if (e.target === settingsOverlay) {
          settingsOverlay.remove();
        }
      });
    }

    // カラー変換ヘルパー
    function rgbaToHex(rgba: string): string {
      // rgba(0, 0, 0, 0.95) -> #000000
      const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) return '#000000';
      const r = parseInt(match[1]).toString(16).padStart(2, '0');
      const g = parseInt(match[2]).toString(16).padStart(2, '0');
      const b = parseInt(match[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    function hexToRgba(hex: string): string {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.95)`;
    }

    // キーボードイベントハンドラー
    function handleKeyPress(event: KeyboardEvent) {
      if (!speedReadingActive) return;

      switch (event.key) {
        case ' ':
        case 'ArrowRight':
          event.preventDefault();
          // 次の単語へ
          if (currentWordIndex < words.length - 1) {
            currentWordIndex++;
            displayCurrentWord();
          } else {
            // 最後まで到達
            alert('最後まで読みました！');
            stopSpeedReading();
          }
          break;

        case 'ArrowLeft':
          event.preventDefault();
          // 前の単語へ
          if (currentWordIndex > 0) {
            currentWordIndex--;
            displayCurrentWord();
          }
          break;

        case 'Escape':
          event.preventDefault();
          stopSpeedReading();
          break;
      }
    }

    // 設定を読み込み
    loadSettings();

    // キーボードイベントリスナーを追加
    document.addEventListener('keydown', handleKeyPress);

    // ポップアップからのメッセージを受信
    browser.runtime.onMessage.addListener((message: any) => {
      if (message.type === 'OPEN_SETTINGS') {
        showSettings();
        return Promise.resolve({ success: true });
      } else if (message.type === 'START_READING') {
        startSpeedReading();
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({ success: false });
    });

    // 速読モードを開始するボタンを追加
    const toggleButton = document.createElement('button');
    toggleButton.id = 'readash-toggle-btn';
    toggleButton.textContent = '📖';
    toggleButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      color: white;
      font-size: 28px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 999998;
      transition: transform 0.2s;
    `;
    toggleButton.onmouseover = () => toggleButton.style.transform = 'scale(1.1)';
    toggleButton.onmouseout = () => toggleButton.style.transform = 'scale(1)';
    toggleButton.onclick = startSpeedReading;

    document.body.appendChild(toggleButton);
  },
});
