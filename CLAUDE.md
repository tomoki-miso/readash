# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ReaDash is a browser extension for speed reading that extracts text from web pages and displays it phrase-by-phrase with keyboard navigation. It supports both Japanese (using TinySegmenter) and English text, with intelligent phrase segmentation, image integration, and URL preservation.

**Tech Stack:**
- WXT (v0.20.6): Modern web extension framework
- Svelte 5 (v5.38.6): Popup UI
- TypeScript: Strongly typed development
- Tailwind CSS v4: Utility-first styling
- TinySegmenter: Japanese morphological analysis

## Development Commands

```bash
# Development (Chrome, hot reload)
pnpm dev

# Development (Firefox)
pnpm dev:firefox

# Production build (Chrome)
pnpm build

# Production build (Firefox)
pnpm build:firefox

# Create distribution zip
pnpm zip
pnpm zip:firefox

# Type checking
pnpm check

# Install dependencies (auto-runs wxt prepare)
pnpm install
```

**Build output:** `.output/chrome-mv3/` or `.output/firefox-mv2/`

## Architecture

### Entrypoints Structure

WXT uses an entrypoints-based architecture where each entrypoint becomes part of the extension:

**Content Script** (`src/entrypoints/content.ts` - 1,132 lines)
- Runs on all URLs
- Main speed reading functionality: text extraction, segmentation, overlay UI, keyboard controls
- Self-contained with minimal dependencies (uses lib utilities)

**Popup** (`src/entrypoints/popup/`)
- Browser action popup with Svelte UI
- Sends messages to content script: `START_READING`, `OPEN_SETTINGS`
- Uses `browser.tabs.sendMessage()` for communication

### Library Organization

**Constants** (`src/lib/constants.ts`)
- Centralized configuration for all magic numbers
- Exports: `LANGUAGE_DETECTION`, `SEGMENTATION`, `UI`, `DEFAULT_SETTINGS`, `STORAGE_KEYS`, `DOM_IDS`, `CSS_CLASSES`, `CONTENT_SELECTORS`, `PATTERNS`
- When adding new thresholds/sizes/colors, add them here first

**Utilities** (`src/lib/utils/`)

`Logger.ts`:
- Singleton logger with levels (DEBUG, INFO, WARN, ERROR, NONE)
- Only active in dev mode (`import.meta.env.DEV`)
- Use instead of `console.log/warn/error`

`UrlProtector.ts`:
- Protects URLs during text segmentation by replacing with placeholders (`__URL_0__`)
- Handles fragmented placeholders from TinySegmenter
- Converts to clickable format: `[🔗domain](url)`
- Singleton pattern: `urlProtector.protect()`, `urlProtector.restore()`, etc.

### Settings & Storage

Settings stored in `localStorage` with key `readash-settings`:

```typescript
interface Settings {
  fontSize: number;           // 32-128px
  textColor: string;          // Hex color
  backgroundColor: string;    // RGBA string
  showImageIndicators: boolean;
  maxWordsPerPhrase: number; // 1-5 words
}
```

Settings flow: Load from localStorage → Settings panel UI → Real-time preview → Save to localStorage → Re-segment if `maxWordsPerPhrase` changes

## Key Functionality

### Text Extraction Pipeline

1. Find main content using `CONTENT_SELECTORS` (article, main, [role="main"], etc.)
2. Query text elements: `p, h1-h6, blockquote` and images: `img, figure`
3. Exclude navigation/header/footer using `CSS_CLASSES`
4. Filter by minimum text length (20 chars from `SEGMENTATION.MIN_TEXT_LENGTH`)
5. Extract images with alt text and captions

### Text Segmentation

**Japanese:**
- TinySegmenter tokenizes text
- `urlProtector.mergeFragmentedPlaceholders()` fixes split URLs
- Create phrases based on:
  - Quote/parenthesis grouping
  - Date patterns (2024年11月15日)
  - Number grouping (up to 4 digits)
  - Punctuation boundaries (、。！？)
  - Te-form verb + auxiliary verb combinations
  - `maxWordsPerPhrase` setting

**English:**
- Split on sentence punctuation (.!?)
- Break at commas/semicolons/colons with whitespace
- Respect `maxWordsPerPhrase` setting

**Mixed Language:**
- Detect sentences by punctuation
- Process each with appropriate segmenter

### Overlay UI

- Fixed fullscreen overlay (z-index: 9999999)
- Vertical display: Previous (60%, 0.3 opacity) → Current (100%, highlighted) → Next (60%, 0.3 opacity)
- Progress indicator at top
- Images displayed inline (context: 40vw×30vh, current: 80vw×60vh)
- Smooth fade animations (200ms from `UI.ANIMATION_DURATION`)
- Controls: Space/Right=next, Left=previous, ESC=exit

### Floating Toggle Button

- Bottom-right (20px), 60px diameter circle
- White background with logo.png
- Z-index: 999998
- Hover scale effect (1.1x)

## Code Patterns & Conventions

### Adding New Constants

Always add to `src/lib/constants.ts` instead of hardcoding:

```typescript
// Bad
if (ratio > 0.3) { ... }

// Good
if (ratio > LANGUAGE_DETECTION.JAPANESE_RATIO_THRESHOLD) { ... }
```

### Logging

Use logger utility instead of console:

```typescript
// Bad
console.log('Extracted text:', text);

// Good
logger.debug('Extracted text:', text);
logger.info('Speed reading started');
logger.error('Failed to load settings:', error);
```

### URL Handling

Always use UrlProtector for URL-related operations:

```typescript
// Protect URLs before segmentation
const { text, urls } = urlProtector.protect(rawText);

// Check if token is placeholder
if (urlProtector.isPlaceholder(token)) {
  const link = urlProtector.toUrlLink(token, urls);
}

// Merge fragmented placeholders after TinySegmenter
const merged = urlProtector.mergeFragmentedPlaceholders(tokens);
```

### TypeScript Path Aliases

Use configured aliases for cleaner imports:

```typescript
import { logger } from '@/lib/utils/Logger';
import { DEFAULT_SETTINGS } from '@/lib/constants';
import logoUrl from '@/assets/logo.png';
```

## Manifest & Permissions

**Current configuration:**
- Manifest V3 (Chrome/Edge)
- Manifest V2 (Firefox)
- Host permissions: `<all_urls>` (content script runs on all pages)

**Note:** Chrome Web Store has flagged broad host permissions. Consider migrating to `activeTab` if functionality allows (requires user to click extension per page).

## Important Files

- `src/entrypoints/content.ts`: Main speed reading logic (1,132 lines)
- `src/lib/constants.ts`: All configuration values
- `src/lib/utils/UrlProtector.ts`: URL handling logic
- `src/lib/utils/Logger.ts`: Development logging
- `wxt.config.ts`: Extension configuration
- `package.json`: Version (currently 0.1.0) and dependencies
- `tiny-segmenter.d.ts`: Type definitions for TinySegmenter

## Japanese Language Support

The extension has sophisticated Japanese text handling:

- TinySegmenter for morphological analysis
- Quote/parenthesis grouping (「」（）)
- Date pattern recognition (年月日)
- Number grouping with proper digit handling
- Te-form verb detection and auxiliary verb merging
- Punctuation-aware phrase boundaries (、。！？)

When modifying Japanese segmentation logic, test with various text types:
- News articles
- Blog posts with mixed punctuation
- Text with dates and numbers
- Quoted dialogue

## Development Tips

**Hot Reload:** `pnpm dev` provides hot reload for quick iteration

**Testing in Browser:**
1. Run `pnpm dev`
2. Chrome: Load unpacked from `.output/chrome-mv3/`
3. Firefox: Load temporary add-on from `.output/firefox-mv2/manifest.json`
4. Navigate to any page with substantial text
5. Click floating button or extension icon → "Start Reading"

**Debugging:**
- Logger only works in dev mode
- Check content script console (page's DevTools)
- Check popup console (extension popup's DevTools: right-click → Inspect)

**TypeScript Checking:**
```bash
pnpm check  # Checks Svelte components and TypeScript
```

**Distribution:**
```bash
pnpm build
pnpm zip
# Creates .output/readash-0.1.0-chrome.zip
```
