/* The Excretory Wheel — game logic. No network access, no dependencies. */
(function(){
'use strict';

const BANK = self.WORD_BANK;
const LETTERS = Object.keys(BANK);
const N = LETTERS.length;
const TIMERS = [120, 180, 0];          // seconds; 0 = no timer
const KEY_GAME = 'excretory-wheel-game';
const KEY_PREFS = 'excretory-wheel-prefs';
const $ = id => document.getElementById(id);

function load(key){
  try{ return JSON.parse(localStorage.getItem(key)); }catch(e){ return null; }
}
function store(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
}

const prefs = Object.assign({timer:120, sound:true, read:false}, load(KEY_PREFS) || {});
if(!TIMERS.includes(prefs.timer)) prefs.timer = 120;
prefs.sound = prefs.sound !== false;
prefs.read = prefs.read === true;

let s;                 // game state
let lastKey = '';      // words of the previous wheel, to avoid dealing the same one twice in a row
let discs = [];

/* ---------- Sound (Web Audio, works offline) ---------- */
let ac = null;
function wakeAudio(){
  try{
    if(!ac){
      const C = window.AudioContext || window.webkitAudioContext;
      if(C) ac = new C();
    }
    // iOS reports "interrupted" (not "suspended") after a screen lock or a call.
    if(ac && ac.state !== 'running') ac.resume();
  }catch(e){ ac = null; }
}
function tone(type, hz, at, dur, vol){
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.value = hz;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(at); o.stop(at + dur + 0.02);
}
function sound(fn){
  if(!prefs.sound || !ac) return;
  try{ fn(ac.currentTime); }catch(e){}
}
function tick(high){ sound(t => tone('square', high ? 1150 : 820, t, 0.06, 0.2)); }
function tenseTick(high, beat){
  sound(t => {
    tone('square', high ? 1500 : 1250, t, 0.045, 0.2);
    if(beat) tone('sine', 70, t, 0.16, 0.5);
  });
}
function okSound(){
  sound(t => {
    tone('triangle', 784, t, 0.14, 0.3);
    tone('triangle', 1047, t + 0.11, 0.14, 0.3);
    tone('triangle', 1568, t + 0.22, 0.3, 0.3);
  });
}
function failSound(){
  sound(t => {
    tone('sawtooth', 165, t, 0.18, 0.28);
    tone('sawtooth', 110, t + 0.17, 0.4, 0.28);
  });
}
function horn(){
  sound(t => {
    [185, 233, 370].forEach(hz => tone('sawtooth', hz, t, 1.3, 0.14));
  });
}

/* ---------- Reading aloud (optional, British English only) ---------- */
const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
let gbVoice = null;
function findVoice(){
  if(!canSpeak) return;
  let voices = [];
  try{ voices = speechSynthesis.getVoices() || []; }catch(e){}
  const novelty = /eloquence|grandma|grandpa|rocko|eddy|flo|reed|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox/i;
  const gb = voices.filter(v => String(v.lang).replace('_', '-').toLowerCase() === 'en-gb'
    && !novelty.test(String(v.name) + ' ' + String(v.voiceURI || '')));
  const local = gb.filter(v => v.localService !== false);
  const pool = local.length ? local : gb;
  gbVoice = pool.find(v => /daniel|kate|serena|martha|arthur|oliver/i.test(String(v.name)))
    || pool.find(v => v.default) || pool[0] || null;
}
function hush(){
  try{ if(canSpeak) speechSynthesis.cancel(); }catch(e){}
}
function label(w){
  return (w.type === 'contains' ? 'Contains the letter ' : 'Starts with ') + w.l;
}
function speak(force){
  if(!gbVoice || s.phase !== 'run' || s.cur < 0) return;
  if(!force && !prefs.read) return;
  try{
    const w = s.words[s.cur];
    speechSynthesis.cancel();
    [label(w) + '.', w.d].forEach(text => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.voice = gbVoice;
      u.rate = 0.9;
      speechSynthesis.speak(u);
    });
  }catch(e){}
}

/* ---------- Clock ---------- */
let iv = null, deadline = 0, lastSec = null, lastHalf = null;
function tenseMs(){ return Math.min(60000, s.total / 4); }
function paintTime(){
  const clock = $('clock');
  clock.classList.toggle('untimed', s.total === 0);
  if(s.total === 0){
    $('time').textContent = '∞';
    clock.classList.remove('low', 'tense');
    return;
  }
  const sec = Math.ceil(s.left / 1000);
  $('time').textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  $('bar').style.width = (100 * s.left / s.total) + '%';
  clock.classList.toggle('low', sec <= 10);
  clock.classList.toggle('tense', s.left <= tenseMs() && sec > 10);
}
function runTimer(){
  clearInterval(iv); iv = null;
  if(s.total === 0) return;
  deadline = performance.now() + s.left;
  lastSec = Math.ceil(s.left / 1000);
  lastHalf = Math.ceil(s.left / 500);
  iv = setInterval(step, 50);
}
function haltTimer(){
  if(iv){
    clearInterval(iv);
    iv = null;
    s.left = Math.max(0, deadline - performance.now());
  }
}
function step(){
  s.left = Math.max(0, deadline - performance.now());
  if(s.left <= 0){
    clearInterval(iv); iv = null;
    s.phase = 'done';
    s.timeUp = true;
    s.cur = -1;
    hush();
    horn();
    render();
    return;
  }
  const sec = Math.ceil(s.left / 1000);
  const half = Math.ceil(s.left / 500);
  if(s.left <= tenseMs()){
    if(half !== lastHalf) tenseTick(half % 2 === 0, half % 2 === 0);
  } else if(sec !== lastSec){
    tick(sec % 2 === 0);
  }
  lastSec = sec;
  lastHalf = half;
  paintTime();
}

/* ---------- Game ---------- */
function deal(){
  return LETTERS.map(l => {
    const list = BANK[l];
    const e = list[Math.floor(Math.random() * list.length)];
    return {l:l, type:e.type, w:e.word, d:e.clue};
  });
}
function keyOf(words){ return words.map(w => w.d).join('|'); }
function draw(){
  let words = deal();
  for(let i = 0; i < 20 && keyOf(words) === lastKey; i++) words = deal();
  lastKey = keyOf(words);
  return words;
}
function fresh(){
  const total = prefs.timer * 1000;
  return {words:draw(), st:Array(N).fill('pending'), passed:Array(N).fill(false), cur:0,
          shown:false, hist:[], phase:'ready', left:total, total:total, timeUp:false};
}
function nextPending(from){
  for(let i = 1; i <= N; i++){
    const j = (from + i) % N;
    if(s.st[j] === 'pending') return j;
  }
  return -1;
}
function mark(v){
  if(s.phase !== 'run' || s.cur < 0) return;
  wakeAudio();
  hush();
  s.hist.push({cur:s.cur, st:s.st[s.cur], passed:s.passed[s.cur]});
  if(v === 'pass') s.passed[s.cur] = true; else s.st[s.cur] = v;
  if(v === 'hit') okSound(); else if(v === 'miss') failSound();
  s.cur = nextPending(s.cur);
  s.shown = false;
  if(s.cur < 0){ haltTimer(); s.phase = 'done'; }
  render();
  speak();
}
function undo(){
  if(s.timeUp) return;
  const h = s.hist.pop();
  if(!h) return;
  wakeAudio();
  s.st[h.cur] = h.st;
  s.passed[h.cur] = h.passed;
  s.cur = h.cur;
  s.shown = false;
  if(s.phase === 'done'){ s.phase = 'run'; runTimer(); }
  render();
  speak();
}
function go(){
  wakeAudio();
  if(!gbVoice) findVoice();     // some Safari versions never fire "voiceschanged"
  hush();
  if(s.phase === 'ready' || s.phase === 'pause'){ s.phase = 'run'; runTimer(); }
  else if(s.phase === 'run'){ haltTimer(); s.phase = 'pause'; }
  render();
  speak();
}
function pause(){
  if(s && s.phase === 'run'){
    haltTimer();
    hush();
    s.phase = 'pause';
    render();
  }
}
function setTimer(seconds){
  if(s.phase === 'run' || s.phase === 'pause' || seconds === prefs.timer) return;
  prefs.timer = seconds;
  store(KEY_PREFS, prefs);
  if(s.phase === 'ready'){
    s.total = s.left = seconds * 1000;
    render();
  } else {
    newGame();
  }
}
function buildDiscs(){
  discs.forEach(d => d.remove());
  discs = s.words.map((w, i) => {
    const d = document.createElement('div');
    const a = (-90 + i * 360 / N) * Math.PI / 180;
    d.className = 'disc';
    d.textContent = w.l;
    d.style.left = (50 + 40 * Math.cos(a)) + '%';
    d.style.top = (50 + 40 * Math.sin(a)) + '%';
    $('wheel').appendChild(d);
    return d;
  });
}
function newGame(){
  clearInterval(iv); iv = null;
  hush();
  s = fresh();
  buildDiscs();
  render();
}

/* ---------- Rendering ---------- */
function render(){
  const hits = s.st.filter(x => x === 'hit').length;
  const miss = s.st.filter(x => x === 'miss').length;
  const pend = N - hits - miss;
  const playing = s.phase === 'run';
  const done = s.phase === 'done';
  const midGame = s.phase === 'run' || s.phase === 'pause';

  discs.forEach((d, i) => {
    d.className = 'disc'
      + (s.st[i] === 'hit' ? ' hit' : s.st[i] === 'miss' ? ' miss' : s.passed[i] ? ' passed' : '')
      + (i === s.cur && !done && s.phase !== 'ready' ? ' now' : '');
  });
  $('hits').textContent = hits;

  const tally = $('tally');
  tally.textContent = '';
  const b1 = document.createElement('b'); b1.textContent = miss;
  const b2 = document.createElement('b'); b2.textContent = pend;
  tally.append(b1, ' wrong · ', b2, ' to go');

  $('undo').disabled = s.hist.length === 0 || s.timeUp;
  paintTime();

  TIMERS.forEach(t => {
    const b = $('t-' + t);
    b.setAttribute('aria-pressed', String(prefs.timer === t));
    b.disabled = midGame;
  });

  const goBtn = $('go');
  goBtn.textContent = s.phase === 'run' ? 'Pause' : s.phase === 'pause' ? 'Resume' : 'Start';
  goBtn.disabled = done;

  $('snd').textContent = prefs.sound ? 'Sound: on' : 'Sound: off';
  $('snd').setAttribute('aria-pressed', String(prefs.sound));
  const reading = prefs.read && !!gbVoice;
  const voiceBtn = $('voice');
  voiceBtn.disabled = !gbVoice;
  voiceBtn.textContent = !gbVoice ? 'Read aloud: no UK voice' : reading ? 'Read aloud: on' : 'Read aloud: off';
  voiceBtn.setAttribute('aria-pressed', String(reading));

  $('play').hidden = done;
  $('final').hidden = !done;
  ['btn-hit', 'btn-miss', 'btn-pass'].forEach(id => { $(id).disabled = !playing; });

  if(!done){
    $('answer-row').hidden = !playing;
    $('read').hidden = !playing || !reading;
    if(playing){
      const w = s.words[s.cur];
      $('starts').textContent = label(w);
      $('clue').textContent = w.d;
      const ans = $('answer');
      ans.textContent = s.shown ? w.w : 'Answer hidden';
      ans.className = s.shown ? 'word' : 'hidden';
      $('toggle').textContent = s.shown ? 'Hide answer' : 'Show answer';
    } else if(s.phase === 'ready'){
      $('starts').textContent = 'Wheel ready';
      $('clue').textContent = s.total === 0
        ? 'Press Start. There is no time limit for the ' + N + ' letters.'
        : 'Press Start. You have ' + (s.total / 60000) + ' minutes for the ' + N + ' letters.';
    } else {
      $('starts').textContent = 'Paused';
      $('clue').textContent = 'Press Resume to go back to the game.';
    }
  } else {
    $('final-title').textContent =
      hits === N ? 'Full wheel!' :
      s.timeUp ? 'Time is up!' :
      hits >= 6 ? 'Great job!' :
      hits >= 3 ? 'Good try!' : 'Let us try again!';
    const score = $('final-score');
    score.textContent = '';
    const b = document.createElement('b');
    b.textContent = hits + ' out of ' + N;
    score.append('Final score: ', b);
    const ul = $('review');
    ul.textContent = '';
    s.words.forEach((w, i) => {
      const li = document.createElement('li');
      const st = s.st[i];
      const tag = document.createElement('span');
      tag.className = 'tag ' + (st === 'hit' ? 'ok' : st === 'miss' ? 'ko' : 'no');
      tag.textContent = w.l;
      const word = document.createElement('span');
      word.textContent = w.w;
      const res = document.createElement('span');
      res.className = 'res';
      res.textContent = st === 'hit' ? 'Correct' : st === 'miss' ? 'Wrong' : 'Not answered';
      li.append(tag, word, res);
      ul.appendChild(li);
    });
  }
  save();
}

/* ---------- Saving and restoring ---------- */
function save(){
  if(iv) s.left = Math.max(0, deadline - performance.now());
  store(KEY_GAME, s);
}
function valid(g){
  if(!g || !Array.isArray(g.words) || g.words.length !== N) return false;
  if(!g.words.every((w, i) => w && w.l === LETTERS[i] && typeof w.w === 'string' && typeof w.d === 'string'
       && (w.type === 'starts' || w.type === 'contains'))) return false;
  if(!Array.isArray(g.st) || g.st.length !== N
     || !g.st.every(x => x === 'pending' || x === 'hit' || x === 'miss')) return false;
  if(!Array.isArray(g.passed) || g.passed.length !== N || !g.passed.every(x => typeof x === 'boolean')) return false;
  if(!Array.isArray(g.hist) || !g.hist.every(h => h && Number.isInteger(h.cur) && h.cur >= 0 && h.cur < N
       && (h.st === 'pending' || h.st === 'hit' || h.st === 'miss') && typeof h.passed === 'boolean')) return false;
  if(typeof g.total !== 'number' || !TIMERS.includes(g.total / 1000)) return false;
  if(typeof g.left !== 'number' || !(g.left >= 0 && g.left <= g.total)) return false;
  if(!['ready', 'run', 'pause', 'done'].includes(g.phase)) return false;
  if(!Number.isInteger(g.cur) || g.cur < -1 || g.cur >= N) return false;
  const pending = g.st.includes('pending');
  if(g.phase === 'done'){ if(pending && !g.timeUp) return false; }
  else if(g.cur < 0 || g.st[g.cur] !== 'pending') return false;
  if(g.phase === 'ready' && (g.hist.length || !g.st.every(x => x === 'pending'))) return false;
  return true;
}
function start(){
  const saved = load(KEY_GAME);
  if(valid(saved)){
    s = saved;
    s.timeUp = s.timeUp === true;
    s.shown = false;
    if(s.phase === 'run') s.phase = 'pause';
    if(s.phase === 'ready'){ s.total = s.left = prefs.timer * 1000; }
    lastKey = keyOf(s.words);
    buildDiscs();
    render();
  } else {
    newGame();
  }
}

/* ---------- Events ---------- */
$('btn-hit').addEventListener('click', () => mark('hit'));
$('btn-miss').addEventListener('click', () => mark('miss'));
$('btn-pass').addEventListener('click', () => mark('pass'));
$('toggle').addEventListener('click', () => { wakeAudio(); s.shown = !s.shown; render(); });
$('undo').addEventListener('click', undo);
$('again').addEventListener('click', newGame);
$('new').addEventListener('click', newGame);
$('go').addEventListener('click', go);
$('read').addEventListener('click', () => speak(true));
TIMERS.forEach(t => $('t-' + t).addEventListener('click', () => setTimer(t)));
$('snd').addEventListener('click', () => {
  prefs.sound = !prefs.sound;
  store(KEY_PREFS, prefs);
  if(prefs.sound) wakeAudio();
  render();
});
$('voice').addEventListener('click', () => {
  if(!gbVoice) return;
  prefs.read = !prefs.read;
  store(KEY_PREFS, prefs);
  if(prefs.read) speak(); else hush();
  render();
});

/* Leaving the app (home button, screen lock) pauses the clock instead of losing time. */
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });
window.addEventListener('pagehide', () => { pause(); if(s) save(); });

findVoice();
if(canSpeak){
  try{
    speechSynthesis.addEventListener('voiceschanged', () => { findVoice(); if(s) render(); });
  }catch(e){}
}

start();

/* ---------- Offline support ---------- */
function offline(state, text){
  const el = $('offline');
  el.dataset.state = state;
  el.textContent = text;
}
/* On an iPad the Safari tab and the Home Screen app keep separate offline copies, so a tab
   that is ready still has to be added to the Home Screen and opened once from there. */
const inSafariTab = 'standalone' in navigator && !navigator.standalone;
if('serviceWorker' in navigator){
  const slow = setTimeout(() => offline('fail', 'Not ready for offline yet'), 30000);
  navigator.serviceWorker.register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => {
      clearTimeout(slow);
      offline('ready', inSafariTab ? 'Ready: now add to Home Screen' : 'Ready to play offline');
    })
    .catch(() => { clearTimeout(slow); offline('fail', 'Online only'); });
} else {
  offline('fail', 'Online only');
}

})();
