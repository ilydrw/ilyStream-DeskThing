/**
 * Cross-device emoji rendering.
 *
 * - The Car Thing runs Chromium 69 on a stripped-down Linux that's missing
 *   modern emoji glyphs (anything Unicode 14+). The system font draws those
 *   as tofu boxes, so we have to swap them out for Twemoji `<img>` SVGs.
 * - Modern browsers (DeskThing dev mode, anything ≥ Chrome 80-ish) render
 *   emoji natively just fine — and Twemoji's `parse` on a recent CDN build
 *   was splitting ZWJ sequences (👨‍👩‍👧, 🏳️‍🌈, skin-toned compounds, etc.)
 *   into multiple `<img>` tags, half pointing at SVGs that don't exist in
 *   the asset folder. The result is "half the emoji, half a broken-image
 *   icon" on Drew's web browser test devices.
 *
 * Strategy:
 *   1. Feature-test once at startup whether the device can render a
 *      Unicode 14 emoji. If yes (modern browser), bypass Twemoji entirely
 *      and let the OS draw the glyph — no broken images possible.
 *   2. If no (Car Thing's old Chromium), fall back to Twemoji and pin the
 *      asset/script version so we stay on a known-good emoji table.
 *      The SVG URL is wrapped in `DeskThing.useProxy` so the PC fetches
 *      from jsDelivr and serves to the LAN-isolated device.
 *   3. Either way, broken `<img>` tags get an `onerror` that hides them
 *      so the user never sees a missing-image placeholder.
 */

import { DeskThing } from '@deskthing/client'

declare const twemoji: any

// Pinned version — `@latest` was resolving to a build whose emoji regex
// didn't match newer ZWJ sequences, producing fragmented img tags.
const TWEMOJI_VERSION = '15.1.0'
const TWEMOJI_BASE = `https://cdn.jsdelivr.net/npm/@twemoji/api@${TWEMOJI_VERSION}/assets/`

// Feature test: can the device render a Unicode 14 emoji? Cached so the
// canvas allocation only happens once.
let cachedNativeSupport: boolean | null = null

function supportsNativeEmoji(): boolean {
  if (cachedNativeSupport !== null) return cachedNativeSupport
  try {
    if (typeof document === 'undefined') {
      cachedNativeSupport = false
      return false
    }
    const canvas = document.createElement('canvas')
    canvas.width = 30
    canvas.height = 30
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      cachedNativeSupport = false
      return false
    }
    ctx.textBaseline = 'top'
    ctx.font = '20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    // 🫠 melting face — Unicode 14 (2021), missing on Chromium 69 / Car Thing.
    ctx.fillText('\u{1FAE0}', 0, 0)
    const data = ctx.getImageData(0, 0, 30, 30).data
    // If every pixel matches the top-left pixel, nothing was drawn (tofu/empty).
    const r0 = data[0]
    const g0 = data[1]
    const b0 = data[2]
    const a0 = data[3]
    for (let i = 4; i < data.length; i += 4) {
      if (data[i] !== r0 || data[i + 1] !== g0 || data[i + 2] !== b0 || data[i + 3] !== a0) {
        cachedNativeSupport = true
        return true
      }
    }
    cachedNativeSupport = false
    return false
  } catch {
    cachedNativeSupport = false
    return false
  }
}

function buildAssetUrl(icon: string, options: any): string {
  const folder = options.folder || 'svg'
  const ext = options.ext || '.svg'
  const base = options.base || TWEMOJI_BASE
  const original = `${base}${folder}/${icon}${ext}`
  try {
    const proxied = DeskThing.useProxy(original)
    return proxied || original
  } catch {
    return original
  }
}

// Hide any `<img>` whose source 404s so a broken composite never shows a
// browser-default missing-image icon. We only inject the handler when we
// actually render Twemoji output (the modern-browser path doesn't need it).
const HIDE_BROKEN_ATTR = ' onerror="this.style.display=\'none\'"'

function injectImgErrorHandlers(html: string): string {
  // Twemoji emits `<img class="emoji" ... draggable="false" ...>`. Append an
  // onerror just before the closing `>` if it's missing.
  return html.replace(/<img\b((?:(?!\/?\s*>)[^])*?)>/g, (match, attrs) => {
    if (/\bonerror\s*=/.test(attrs)) return match
    return `<img${attrs}${HIDE_BROKEN_ATTR}>`
  })
}

export function Emoji({ text, className }: { text: string; className?: string }) {
  if (text === '' || text == null) {
    return <span className={className} />
  }

  // Modern browser path — system font handles every emoji, no broken images.
  if (supportsNativeEmoji()) {
    return <span className={className}>{text}</span>
  }

  // Car Thing path — Twemoji or bust.
  if (typeof twemoji === 'undefined') {
    return <span className={className}>{text}</span>
  }

  const parsed = twemoji.parse(text, {
    folder: 'svg',
    ext: '.svg',
    base: TWEMOJI_BASE,
    callback: (icon: string, options: any) => buildAssetUrl(icon, options),
    className: 'emoji'
  })

  const html = injectImgErrorHandlers(parsed)
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
