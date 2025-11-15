# ReaDash

速読を実現するブラウザ拡張機能。Webページから本文を抽出し、フレーズごとにキーボード操作で読み進めることができます。

A browser extension for speed reading that extracts text from web pages and displays it phrase-by-phrase with keyboard navigation.

## 特徴 / Features

- **インテリジェントなテキスト抽出** - Webページから本文を自動抽出し、ナビゲーションや広告を除外
- **日本語・英語対応** - 日本語は形態素解析、英語は文法的な区切りで自然なフレーズに分割
- **画像の統合表示** - テキストに関連する画像をインラインで表示
- **URLの保護** - URLをリンクとして保持し、クリックで新しいタブで開く
- **カスタマイズ可能** - フォントサイズ、色、背景色、1フレーズあたりの単語数を調整可能
- **キーボード操作** - スペースキーや矢印キーで快適にナビゲーション

## インストール / Installation

### Chrome / Edge

1. このリポジトリをクローン:
   ```bash
   git clone https://github.com/yourusername/readash.git
   cd readash
   ```

2. 依存関係をインストール:
   ```bash
   pnpm install
   ```

3. ビルド:
   ```bash
   pnpm build
   ```

4. Chromeで拡張機能を読み込む:
   - `chrome://extensions/` を開く
   - 「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `.output/chrome-mv3/` ディレクトリを選択

### Firefox

1. ビルド (Firefox用):
   ```bash
   pnpm build:firefox
   ```

2. Firefoxで拡張機能を読み込む:
   - `about:debugging#/runtime/this-firefox` を開く
   - 「一時的なアドオンを読み込む」をクリック
   - `.output/firefox-mv2/manifest.json` を選択

## 使い方 / Usage

1. **速読モードを開始**
   - 拡張機能アイコンをクリックして「Start Reading」をクリック
   - または、ページ右下の浮動ボタンをクリック

2. **ナビゲーション**
   - `Space` または `→` : 次のフレーズへ
   - `←` : 前のフレーズへ
   - `ESC` : 速読モードを終了

3. **設定**
   - 拡張機能アイコンをクリックして「Settings」をクリック
   - フォントサイズ (32-128px)
   - テキスト色
   - 背景色
   - 1フレーズあたりの単語数 (1-5)
   - 画像インジケーターの表示/非表示

## 開発 / Development

### 必要な環境

- Node.js 18+
- pnpm

### セットアップ

```bash
# 依存関係をインストール
pnpm install

# 開発モード (Chrome, ホットリロード)
pnpm dev

# 開発モード (Firefox)
pnpm dev:firefox

# 型チェック
pnpm check

# プロダクションビルド
pnpm build
pnpm build:firefox

# 配布用zipファイルを作成
pnpm zip
pnpm zip:firefox
```

### プロジェクト構成

```
src/
├── entrypoints/          # 拡張機能のエントリーポイント
│   ├── content.ts       # メインの速読ロジック
│   └── popup/           # ポップアップUI (Svelte)
├── lib/                  # 共有ライブラリ
│   ├── constants.ts     # アプリ全体の定数
│   └── utils/           # ユーティリティ関数
│       ├── Logger.ts    # 開発用ロガー
│       └── UrlProtector.ts  # URL処理
└── assets/              # 静的アセット
```

詳細なアーキテクチャについては [CLAUDE.md](./CLAUDE.md) を参照してください。

## 技術スタック / Tech Stack

- **[WXT](https://wxt.dev/)** - モダンなWeb拡張機能フレームワーク
- **[Svelte 5](https://svelte.dev/)** - UIフレームワーク
- **[TypeScript](https://www.typescriptlang.org/)** - 型安全な開発
- **[Tailwind CSS v4](https://tailwindcss.com/)** - ユーティリティファーストCSS
- **[TinySegmenter](https://github.com/leungwensen/tiny-segmenter)** - 日本語形態素解析

## 対応ブラウザ / Browser Support

- Chrome / Edge (Manifest V3)
- Firefox (Manifest V2)

## ライセンス / License

MIT

## 貢献 / Contributing

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容について議論してください。

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 作者 / Author

Developed with Claude Code
