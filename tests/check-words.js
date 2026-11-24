/* Checks the word bank. Run with: node tests/check-words.js */
const bank = require('../words.js');

const errors = [];
const letters = Object.keys(bank);
if (letters.length !== 8) errors.push('Expected 8 letters, found ' + letters.length);

const BANNED = /\b(skin|sweat|pores?|lungs?|glands?|carbon dioxide)\b/i;
const owner = {};

for (const l of letters) {
  const list = bank[l];
  if (!/^[A-Z]$/.test(l)) errors.push(l + ': letter must be one capital letter');
  if (!Array.isArray(list) || list.length === 0) { errors.push(l + ': no entries'); continue; }
  const clues = new Set();
  for (const e of list) {
    const where = l + ' / ' + e.word;
    if (!['starts', 'contains'].includes(e.type)) errors.push(where + ': bad type ' + e.type);
    if (typeof e.word !== 'string' || !e.word.trim()) errors.push(where + ': empty word');
    if (typeof e.clue !== 'string' || e.clue.trim().length < 15) errors.push(where + ': clue too short');
    const word = String(e.word).toUpperCase();
    if (e.type === 'starts' && !word.startsWith(l)) errors.push(where + ': does not start with ' + l);
    if (e.type === 'contains' && !word.includes(l)) errors.push(where + ': does not contain ' + l);
    if (e.type === 'contains' && word.startsWith(l)) errors.push(where + ': starts with ' + l + ', use type "starts"');
    if (clues.has(e.clue)) errors.push(where + ': repeated clue');
    clues.add(e.clue);
    if (BANNED.test(e.word + ' ' + e.clue)) errors.push(where + ': mentions skin or lungs, which are out of scope');
    // The clue must not give the answer away.
    for (const part of String(e.word).toLowerCase().split(/\s+/)) {
      const stem = part.replace(/s$/, '');
      if (stem.length > 3 && e.clue.toLowerCase().includes(stem)) errors.push(where + ': the clue contains the answer');
    }
    // No word may be the answer for two different letters, or one wheel could ask it twice.
    if (owner[word] && owner[word] !== l) errors.push(where + ': also used for letter ' + owner[word]);
    owner[word] = l;
  }
}

// The four parts of the system must be reachable in every game.
for (const part of ['KIDNEYS', 'URETERS', 'URETHRA']) {
  const l = owner[part];
  if (!l) errors.push(part + ' is missing from the bank');
  else if (!bank[l].every(e => e.word.toUpperCase() === part)) errors.push(part + ' does not appear in every game');
}
if (!owner['BLADDER']) errors.push('BLADDER is missing from the bank');

if (errors.length) {
  console.error('Word bank problems:\n - ' + errors.join('\n - '));
  process.exit(1);
}
const total = letters.reduce((n, l) => n + bank[l].length, 0);
console.log('Word bank OK: ' + letters.length + ' letters (' + letters.join(' ') + '), ' + total + ' clues.');
