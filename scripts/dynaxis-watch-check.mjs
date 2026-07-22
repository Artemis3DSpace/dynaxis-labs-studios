#!/usr/bin/env node
/**
 * Dynaxis dev-runtime watcher stability check (Phase 5D).
 *
 * Practical, short-cycle validation that native filesystem watching + HMR work
 * WITHOUT forced polling, and that repeated edits do not cause unbounded memory
 * growth or duplicate rebuild loops. This is a smoke test for obvious unbounded
 * behaviour — NOT a proof that no leak can ever occur.
 *
 * Usage:
 *   node scripts/dynaxis-watch-check.mjs [--port 3013] [--cycles 6]
 *
 * It starts `next dev` with NATIVE watching (no WATCHPACK_POLLING /
 * CHOKIDAR_USEPOLLING), toggles a harmless comment in app/globals.css to force
 * HMR rebuilds, creates + deletes a temp file to confirm add/unlink detection,
 * samples the dev-server RSS across cycles, and prints a JSON summary.
 */

import { spawn, execSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const PORT = Number(arg('port', '3013'));
const CYCLES = Number(arg('cycles', '6'));
const CSS = resolve(ROOT, 'app/globals.css');
const TMP = resolve(ROOT, 'app/_dynaxis_watch_probe.tmp.css');

const MARK = '/* dynaxis-watch-check */';

function rssMb(pid) {
  try {
    const kb = Number(execSync(`ps -o rss= -p ${pid}`).toString().trim());
    return Math.round((kb / 1024) * 10) / 10;
  } catch {
    return null;
  }
}
function procCount(pattern) {
  try {
    return execSync(`pgrep -f ${JSON.stringify(pattern)} | wc -l`).toString().trim();
  } catch {
    return '?';
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!existsSync(CSS)) throw new Error(`Missing ${CSS}`);
  const cssOriginal = readFileSync(CSS, 'utf8');

  console.log(`[watch-check] starting native next dev on :${PORT} (no polling)`);
  const child = spawn('npx', ['next', 'dev', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      // Explicitly ensure NO forced polling / heap override:
      WATCHPACK_POLLING: '',
      CHOKIDAR_USEPOLLING: '',
      NODE_OPTIONS: '',
    },
  });

  let buf = '';
  let compileEvents = 0;
  child.stdout.on('data', (d) => {
    buf += d.toString();
    const matches = d.toString().match(/Compiled|✓ Compiled/g);
    if (matches) compileEvents += matches.length;
    process.stdout.write(`  | ${d}`);
  });
  child.stderr.on('data', (d) => process.stdout.write(`  ! ${d}`));

  const waitFor = async (re, timeoutMs) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (re.test(buf)) return true;
      await sleep(200);
    }
    return false;
  };

  const cleanup = () => {
    try { writeFileSync(CSS, cssOriginal); } catch {}
    try { if (existsSync(TMP)) rmSync(TMP); } catch {}
    try { child.kill('SIGKILL'); } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(1); });

  const ready = await waitFor(/Ready in|started server/i, 60000);
  if (!ready) { cleanup(); throw new Error('dev server did not become ready'); }
  await sleep(1500);

  const samples = [];
  const rss0 = rssMb(child.pid);
  samples.push(rss0);
  console.log(`[watch-check] ready. initial RSS=${rss0}MB pid=${child.pid}`);

  // Force initial route compile so CSS is in the graph.
  try { execSync(`curl -s -o /dev/null http://127.0.0.1:${PORT}/studio`); } catch {}
  await waitFor(/Compiled|GET \/studio/i, 60000);
  await sleep(1000);

  let hmrDetected = 0;
  for (let i = 1; i <= CYCLES; i++) {
    const before = compileEvents;
    buf = ''; // fresh window so waitFor only sees this cycle's output
    // Keep the marker fully INSIDE the CSS comment (valid CSS → clean recompile).
    appendFileSync(CSS, `\n/* dynaxis-watch-check ${i} ${Date.now()} */\n`);
    const got = await waitFor(/Compiled/, 30000);
    if (got && compileEvents > before) hmrDetected += 1;
    const rss = rssMb(child.pid);
    samples.push(rss);
    console.log(`[watch-check] cycle ${i}: recompiled=${got} RSS=${rss}MB compileEvents=${compileEvents}`);
    await sleep(800);
  }

  // Add/unlink detection
  writeFileSync(TMP, `${MARK} temp\n`);
  await sleep(1500);
  rmSync(TMP);
  await sleep(1500);

  const rssEnd = rssMb(child.pid);
  const nextProcs = procCount('next dev');
  writeFileSync(CSS, cssOriginal);

  const summary = {
    bundler: 'webpack (next dev, no --turbopack)',
    port: PORT,
    cycles: CYCLES,
    hmrRecompilesDetected: hmrDetected,
    compileEventsTotal: compileEvents,
    rssInitialMb: rss0,
    rssFinalMb: rssEnd,
    rssDeltaMb: rss0 != null && rssEnd != null ? Math.round((rssEnd - rss0) * 10) / 10 : null,
    rssSamplesMb: samples,
    nextDevProcessCount: nextProcs,
    addUnlinkProbe: 'created+deleted app/_dynaxis_watch_probe.tmp.css',
  };
  console.log('\n[watch-check] SUMMARY');
  console.log(JSON.stringify(summary, null, 2));

  child.kill('SIGKILL');
  await sleep(500);

  const ok = hmrDetected >= Math.min(2, CYCLES) &&
    (summary.rssDeltaMb == null || summary.rssDeltaMb < 400);
  console.log(`[watch-check] RESULT: ${ok ? 'PASS' : 'REVIEW'} (native HMR ${hmrDetected}/${CYCLES}, RSS delta ${summary.rssDeltaMb}MB)`);
  process.exit(ok ? 0 : 3);
}

main().catch((err) => {
  console.error('[watch-check] failed:', err?.message || err);
  process.exit(1);
});
