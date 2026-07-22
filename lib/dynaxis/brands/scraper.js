/**
 * Brand website scraper — Playwright with SSRF request gating.
 * server-only. Graceful if Playwright is not installed.
 */

import 'server-only';
import { validateAnalysisUrl, validateNavigationTarget } from './url-security.js';

export const BRAND_SCRAPE_LIMITS = {
  navigationTimeoutMs: 45_000,
  networkIdleTimeoutMs: 15_000,
  overallTimeoutMs: 90_000,
  maxBodyChars: 12_000,
  maxSampleElements: 800,
  maxLogoCandidates: 5,
  maxFonts: 20,
  viewport: { width: 1440, height: 900 },
};

/**
 * @returns {Promise<typeof import('playwright')|null>}
 */
async function loadPlaywright() {
  try {
    // webpackIgnore: optional server dep — manual Brand create works without it
    return await import(/* webpackIgnore: true */ 'playwright');
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @param {{ lookupFn?: Function }} [opts]
 */
export async function scrapeBrandWebsite(url, opts = {}) {
  const validated = await validateAnalysisUrl(url, opts);
  const pw = await loadPlaywright();
  if (!pw?.chromium) {
    const err = new Error(
      'Playwright/Chromium is not available. Manual Brand creation still works; install playwright for website analysis.'
    );
    err.code = 'BRAND_SCRAPER_UNAVAILABLE';
    err.status = 503;
    throw err;
  }

  let browser = null;
  let context = null;
  const started = Date.now();

  try {
    browser = await pw.chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
    context = await browser.newContext({
      viewport: BRAND_SCRAPE_LIMITS.viewport,
      javaScriptEnabled: true,
      bypassCSP: false,
    });

    await context.route('**/*', async (route) => {
      const reqUrl = route.request().url();
      try {
        await validateNavigationTarget(reqUrl, opts);
        await route.continue();
      } catch {
        await route.abort('blockedbyclient');
      }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(BRAND_SCRAPE_LIMITS.navigationTimeoutMs);

    page.on('framenavigated', async (frame) => {
      if (frame !== page.mainFrame()) return;
      try {
        await validateNavigationTarget(frame.url(), opts);
      } catch {
        try {
          await page.close();
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto(validated.href, {
      waitUntil: 'domcontentloaded',
      timeout: BRAND_SCRAPE_LIMITS.navigationTimeoutMs,
    });

    // Re-validate final URL after redirects
    await validateNavigationTarget(page.url(), opts);

    try {
      await page.waitForLoadState('networkidle', {
        timeout: BRAND_SCRAPE_LIMITS.networkIdleTimeoutMs,
      });
    } catch {
      // non-fatal
    }

    if (Date.now() - started > BRAND_SCRAPE_LIMITS.overallTimeoutMs) {
      const err = new Error('Brand website analysis timed out');
      err.code = 'BRAND_SCRAPE_TIMEOUT';
      err.status = 408;
      throw err;
    }

    const extracted = await page.evaluate((limits) => {
      const title = document.title || '';
      const description =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute('content') ||
        document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute('content') ||
        '';
      const bodyText = (document.body?.innerText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, limits.maxBodyChars);

      const logoCandidates = [];
      const imgs = Array.from(document.querySelectorAll('img')).slice(0, 200);
      for (const img of imgs) {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        if (/logo/i.test(src) || /logo/i.test(alt)) {
          try {
            logoCandidates.push(new URL(src, location.href).href);
          } catch {
            /* ignore */
          }
        }
        if (logoCandidates.length >= limits.maxLogoCandidates) break;
      }

      const ogImage =
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute('content') || null;
      let favicon =
        document.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
        null;
      try {
        if (ogImage) favicon; // keep
        if (favicon) favicon = new URL(favicon, location.href).href;
      } catch {
        favicon = null;
      }
      let ogAbs = null;
      try {
        if (ogImage) ogAbs = new URL(ogImage, location.href).href;
      } catch {
        ogAbs = null;
      }

      const rawColors = [];
      const fonts = [];
      const nodes = Array.from(document.querySelectorAll('*')).slice(
        0,
        limits.maxSampleElements
      );
      for (const el of nodes) {
        const style = window.getComputedStyle(el);
        if (style.color) rawColors.push(style.color);
        if (style.backgroundColor) rawColors.push(style.backgroundColor);
        if (style.fontFamily) {
          for (const part of style.fontFamily.split(',')) {
            fonts.push(part.trim());
          }
        }
      }

      return {
        title,
        description,
        bodyText,
        logoCandidates: [...new Set(logoCandidates)].slice(
          0,
          limits.maxLogoCandidates
        ),
        ogImage: ogAbs,
        favicon,
        rawColors,
        fonts: [...new Set(fonts)].slice(0, limits.maxFonts),
        finalUrl: location.href,
      };
    }, BRAND_SCRAPE_LIMITS);

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    return {
      sourceUrl: validated.href,
      finalUrl: extracted.finalUrl,
      title: extracted.title,
      description: extracted.description,
      bodyText: extracted.bodyText,
      logoCandidates: extracted.logoCandidates,
      ogImage: extracted.ogImage,
      favicon: extracted.favicon,
      rawColors: extracted.rawColors,
      fonts: extracted.fonts,
      screenshotBuffer: Buffer.from(screenshot),
      capturedAt: new Date().toISOString(),
    };
  } finally {
    try {
      if (context) await context.close();
    } catch {
      /* ignore */
    }
    try {
      if (browser) await browser.close();
    } catch {
      /* ignore */
    }
  }
}
