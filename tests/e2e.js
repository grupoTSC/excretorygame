/* End-to-end checks with Playwright (Chromium).
 * Run with: node tests/e2e.js [folder-for-screenshots]
 * Serves the game under /excretorygame/, the same sub-path GitHub Pages uses. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null;
const BASE = '/excretorygame/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (!url.startsWith(BASE)) { res.writeHead(404); return res.end('not found'); }
    let rel = url.slice(BASE.length) || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let passed = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ok   ' + name); }
  else { failures.push(name); console.log('  FAIL ' + name + (detail ? ' -> ' + detail : '')); }
}
async function shot(page, name) {
  if (!SHOTS) return;
  await page.waitForTimeout(400);   // let colour transitions finish
  await page.screenshot({ path: path.join(SHOTS, name) });
}
const text = (page, id) => page.locator('#' + id).innerText();
const count = (page, sel) => page.locator(sel).count();

const LANDSCAPE = { width: 1180, height: 820 };   // iPad Air, landscape
const PORTRAIT = { width: 820, height: 1180 };

/* A fake speech engine, so reading aloud can be tested in a browser that has no voices. */
function fakeSpeech(langs) {
  return `
    window.__spoken = [];
    window.SpeechSynthesisUtterance = function(t){ this.text = t; };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => ${JSON.stringify(langs)}.map(l => ({ lang: l, name: l, localService: true })),
      speak: u => window.__spoken.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.lang }),
      cancel: () => {},
      addEventListener: () => {}
    }});`;
}

(async () => {
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const url = origin + BASE;
  const browser = await chromium.launch();

  async function open(opts = {}) {
    const context = await browser.newContext({
      viewport: opts.viewport || LANDSCAPE, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: true });
    if (opts.init) await context.addInitScript(opts.init);
    const page = await context.newPage();
    const errors = [], foreign = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));
    context.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) foreign.push(r.url()); });
    return { context, page, errors, foreign };
  }

  /* ---------- 1. Full game, landscape ---------- */
  console.log('1. Full game on a landscape iPad');
  {
    const { context, page, errors, foreign } = await open();
    await page.goto(url);
    await page.waitForSelector('#offline[data-state="ready"]', { timeout: 15000 });
    check('offline badge says ready', (await text(page, 'offline')) === 'Ready to play offline');
    check('wheel has 8 letters', (await count(page, '.disc')) === 8);
    check('letters are B E F H K R U W',
      (await page.locator('.disc').allInnerTexts()).join('') === 'BEFHKRUW');
    check('timer starts at 2:00', (await text(page, 'time')) === '2:00');
    check('verdict buttons disabled before Start', await page.locator('#btn-hit').isDisabled());
    check('read aloud disabled without a UK voice', await page.locator('#voice').isDisabled());
    check('everything fits without scrolling',
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight
        && document.documentElement.scrollWidth <= window.innerWidth));
    await shot(page, '1-ready-landscape.png');

    await page.click('#t-180');
    check('3 min option sets 3:00', (await text(page, 'time')) === '3:00');
    await page.click('#t-0');
    check('no timer option shows infinity', (await text(page, 'time')) === '∞');
    await page.click('#t-120');

    await page.click('#go');
    check('first clue is for B', (await text(page, 'starts')).toUpperCase() === 'STARTS WITH B');
    check('timer options locked during a game', await page.locator('#t-180').isDisabled());
    check('answer is hidden at first', (await text(page, 'answer')) === 'Answer hidden');
    await page.click('#toggle');
    const answerB = await text(page, 'answer');
    check('show answer reveals a B word', /^B/.test(answerB), answerB);
    await shot(page, '2-playing-landscape.png');

    await page.click('#btn-hit');                 // B correct
    check('score is 1', (await text(page, 'hits')) === '1');
    check('B disc is green', (await count(page, '.disc.hit')) === 1);
    await page.click('#btn-miss');                // E wrong
    check('E disc is red', (await count(page, '.disc.miss')) === 1);
    await page.click('#btn-pass');                // F pass
    check('F disc is marked as passed', (await count(page, '.disc.passed')) === 1);
    check('H clue says contains', (await text(page, 'starts')).toUpperCase() === 'CONTAINS THE LETTER H');
    await page.click('#toggle');
    check('H answer is Urethra', (await text(page, 'answer')) === 'Urethra');
    check('tally counts wrong and pending', (await text(page, 'tally')) === '1 wrong · 6 to go');

    await page.click('#undo');                    // back to F
    check('undo returns to F', (await text(page, 'starts')).toUpperCase() === 'STARTS WITH F');
    check('undo clears the pass mark', (await count(page, '.disc.passed')) === 0);
    await page.click('#btn-pass');                // F pass again

    await page.click('#go');                      // pause
    check('pause hides the clue', (await text(page, 'starts')).toUpperCase() === 'PAUSED');
    const frozen = await text(page, 'time');
    await page.waitForTimeout(1300);
    check('clock stops while paused', (await text(page, 'time')) === frozen);
    await page.click('#go');                      // resume
    check('resume goes back to H', (await text(page, 'starts')).toUpperCase() === 'CONTAINS THE LETTER H');

    for (let i = 0; i < 5; i++) await page.click('#btn-hit');   // H K R U W
    check('passed letter comes round again', (await text(page, 'starts')).toUpperCase() === 'STARTS WITH F');
    await page.click('#btn-hit');                 // F
    check('game ends when the wheel is complete', await page.locator('#final').isVisible());
    check('final score is 7 out of 8', (await text(page, 'final-score')) === 'Final score: 7 out of 8');
    check('review lists 8 words', (await count(page, '#review li')) === 8);
    check('review shows the wrong one', (await count(page, '#review .ko')) === 1);
    check('final screen fits, Play again fully visible',
      await page.evaluate(() => {
        const r = document.getElementById('again').getBoundingClientRect();
        const c = document.getElementById('final');
        return r.bottom <= window.innerHeight && c.scrollHeight <= c.clientHeight + 1;
      }));
    await shot(page, '3-final-landscape.png');

    await page.click('#undo');
    check('undo works from the final screen', await page.locator('#play').isVisible());
    await page.click('#btn-hit');
    await page.click('#again');
    check('play again deals a new wheel', (await text(page, 'hits')) === '0' && (await text(page, 'time')) === '2:00');
    check('no console errors', errors.length === 0, errors.join(' | '));
    check('no requests outside the game', foreign.length === 0, foreign.join(' | '));
    await context.close();
  }

  /* ---------- 2. Time runs out ---------- */
  console.log('2. Time runs out');
  {
    // Start from a saved game that is paused with one correct answer and half a second left.
    const bank = require('../words.js');
    const letters = Object.keys(bank);
    const saved = {
      words: letters.map(l => ({ l, type: bank[l][0].type, w: bank[l][0].word, d: bank[l][0].clue })),
      st: letters.map((_, i) => (i === 0 ? 'hit' : 'pending')),
      passed: letters.map(() => false),
      cur: 1, shown: false, hist: [{ cur: 0, st: 'pending', passed: false }],
      phase: 'pause', left: 500, total: 120000, timeUp: false
    };
    const { context, page, errors } = await open({
      init: `if(!sessionStorage.getItem('seeded')){ sessionStorage.setItem('seeded','1');
        localStorage.setItem('excretory-wheel-game', ${JSON.stringify(JSON.stringify(saved))}); }`
    });
    await page.goto(url);
    await page.waitForSelector('.disc');
    check('saved game restored with its score', (await text(page, 'hits')) === '1');
    await page.click('#go');
    await page.waitForSelector('#final:not([hidden])', { timeout: 5000 });
    check('title says time is up', (await text(page, 'final-title')) === 'Time is up!');
    check('unanswered letters are listed', (await count(page, '#review .no')) === 7);
    check('undo is locked after time is up', await page.locator('#undo').isDisabled());
    check('no console errors', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  /* ---------- 3. Closing and reopening mid-game ---------- */
  console.log('3. Closing and reopening in the middle of a game');
  {
    const { context, page } = await open();
    await page.goto(url);
    await page.waitForSelector('.disc');
    await page.click('#t-180');
    await page.click('#go');
    await page.click('#btn-hit');
    await page.click('#btn-miss');
    const cluesBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('excretory-wheel-game')).words.map(w => w.d).join('|'));
    await page.waitForTimeout(1200);
    await page.reload();
    await page.waitForSelector('.disc');
    check('reopens paused', (await text(page, 'go')) === 'Resume');
    check('keeps the score', (await text(page, 'hits')) === '1' && (await count(page, '.disc.miss')) === 1);
    const cluesAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('excretory-wheel-game')).words.map(w => w.d).join('|'));
    check('keeps the same clues', cluesBefore === cluesAfter);
    const t = await text(page, 'time');
    check('keeps the time left', /^2:5\d$/.test(t), t);
    check('remembers the 3 min setting', (await page.locator('#t-180').getAttribute('aria-pressed')) === 'true');
    await page.click('#go');
    check('resumes at the next letter', (await text(page, 'starts')).toUpperCase() === 'STARTS WITH F');
    await context.close();
  }

  /* ---------- 4. Offline ---------- */
  console.log('4. Offline, with the server switched off');
  {
    const { context, page, errors } = await open();
    await page.goto(url);
    await page.waitForSelector('#offline[data-state="ready"]', { timeout: 15000 });
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const c = await caches.open(keys[0]);
      return (await c.keys()).length;
    });
    check('service worker cached all 9 files', cached === 9, String(cached));
    await context.setOffline(true);
    await new Promise(resolve => server.close(resolve));
    server.closeAllConnections && server.closeAllConnections();
    await page.reload();
    await page.waitForSelector('.disc', { timeout: 10000 });
    check('page loads offline', (await count(page, '.disc')) === 8);
    check('styles load offline', await page.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(15, 47, 58)'));
    check('icon loads offline', await page.evaluate(async () => (await fetch('./icons/icon-192.png')).ok));
    check('manifest loads offline', await page.evaluate(async () => (await fetch('./manifest.webmanifest')).ok));
    await page.waitForSelector('#offline[data-state="ready"]', { timeout: 10000 });
    await page.click('#new');
    await page.click('#go');
    for (let i = 0; i < 8; i++) await page.click('#btn-hit');
    check('a whole game can be played offline', (await text(page, 'final-title')) === 'Full wheel!');
    // Opening the bare folder address also works offline.
    await page.goto(url + 'index.html');
    check('index.html address works offline', (await count(page, '.disc')) === 8);
    check('no console errors offline', errors.length === 0, errors.join(' | '));
    await shot(page, '4-offline-landscape.png');
    await context.close();
  }

  const server2 = await serve();
  const url2 = 'http://127.0.0.1:' + server2.address().port + BASE;

  /* ---------- 5. Reading aloud ---------- */
  console.log('5. Reading aloud (optional, en-GB only)');
  {
    const { context, page } = await open({ init: fakeSpeech(['en-US', 'es-ES', 'en-GB']) });
    await page.goto(url2);
    await page.waitForSelector('.disc');
    check('read aloud is available with a UK voice', !(await page.locator('#voice').isDisabled()));
    check('read aloud is off by default', (await text(page, 'voice')) === 'Read aloud: off');
    await page.click('#go');
    await page.click('#btn-hit');
    check('nothing is read while it is off', (await page.evaluate(() => window.__spoken.length)) === 0);
    check('listen button hidden while it is off', !(await page.locator('#read').isVisible()));
    await page.click('#voice');
    check('turning it on reads the current clue', (await page.evaluate(() => window.__spoken.length)) === 2);
    await page.click('#btn-hit');
    const spoken = await page.evaluate(() => window.__spoken);
    check('each clue is read after a verdict', spoken.length === 4);
    check('always uses the en-GB voice', spoken.every(u => u.lang === 'en-GB' && u.voice === 'en-GB'), JSON.stringify(spoken));
    check('reads the letter first', spoken[2].text === 'Starts with F.', spoken[2].text);
    await page.click('#read');
    check('listen again repeats the clue', (await page.evaluate(() => window.__spoken.length)) === 6);
    await page.reload();
    await page.waitForSelector('.disc');
    check('the choice is remembered', (await text(page, 'voice')) === 'Read aloud: on');
    await page.click('#voice');
    await page.click('#go');
    check('turning it off stops the reading', (await page.evaluate(() => window.__spoken.length)) === 0);
    await context.close();
  }
  {
    const { context, page } = await open({ init: fakeSpeech(['en-US', 'es-ES']) });
    await page.goto(url2);
    await page.waitForSelector('.disc');
    check('without a UK voice the switch is disabled', await page.locator('#voice').isDisabled());
    await page.evaluate(() => localStorage.setItem('excretory-wheel-prefs', JSON.stringify({ timer: 120, sound: true, read: true })));
    await page.reload();
    await page.waitForSelector('.disc');
    await page.click('#go');
    check('never reads with another accent', (await page.evaluate(() => window.__spoken.length)) === 0);
    await context.close();
  }

  /* ---------- 6. Portrait and small screens ---------- */
  console.log('6. Portrait iPad and phone');
  {
    const { context, page } = await open({ viewport: PORTRAIT });
    await page.goto(url2);
    await page.waitForSelector('.disc');
    await page.click('#go');
    check('no sideways scrolling in portrait',
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check('portrait fits without scrolling',
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight));
    await shot(page, '5-playing-portrait.png');
    await context.close();
  }
  {
    const { context, page } = await open({ viewport: { width: 390, height: 844 } });
    await page.goto(url2);
    await page.waitForSelector('.disc');
    await page.click('#go');
    check('no sideways scrolling on a phone',
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await shot(page, '6-playing-phone.png');
    await context.close();
  }
  {
    const { context, page } = await open({ viewport: { width: 1024, height: 768 } });   // older iPad
    await page.goto(url2);
    await page.waitForSelector('.disc');
    await page.click('#go');
    check('older iPad landscape fits without scrolling',
      await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight
        && document.documentElement.scrollWidth <= window.innerWidth));
    for (let i = 0; i < 8; i++) await page.click('#btn-miss');
    check('final screen fits on an older iPad, Play again visible',
      await page.evaluate(() => {
        const r = document.getElementById('again').getBoundingClientRect();
        const c = document.getElementById('final');
        return r.bottom <= window.innerHeight && c.scrollHeight <= c.clientHeight + 1
          && document.documentElement.scrollHeight <= window.innerHeight;
      }));
    await shot(page, '7-final-ipad-1024.png');
    await context.close();
  }

  await browser.close();
  server2.close();
  console.log('\n' + passed + ' checks passed, ' + failures.length + ' failed.');
  if (failures.length) { console.log('Failed: ' + failures.join('; ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
