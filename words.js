/* Word bank for The Excretory Wheel.
 *
 * Topic: the excretory (urinary) system only — kidneys, ureters, bladder and urethra —
 * at Year 5 level: the parts, the main function and what each part does.
 *
 * The wheel always has these 8 letters, in this order. Each game picks ONE entry per letter,
 * so add more entries to a letter to get more variety.
 *
 *   type: 'starts'   -> the answer starts with the letter
 *         'contains' -> the answer contains the letter (the clue card says so)
 *   word: the answer the presenter sees
 *   clue: the definition read to the class
 *
 * After changing this file, bump VERSION in sw.js so installed iPads get the new words.
 */
const WORD_BANK = {
  B: [
    { type: 'starts', word: 'Bladder', clue: 'The organ, shaped like a bag, that stores urine until you go to the toilet.' },
    { type: 'starts', word: 'Bladder', clue: 'This organ stretches like a balloon as it fills up with urine.' }
  ],
  E: [
    { type: 'starts', word: 'Excretion', clue: 'The process of removing waste from the body.' },
    { type: 'starts', word: 'Excretory system', clue: 'The group of organs that work together to remove waste from the body.' }
  ],
  F: [
    { type: 'starts', word: 'Filter', clue: 'What the kidneys do to the blood to take the waste out of it.' },
    { type: 'starts', word: 'Filter', clue: 'To clean a liquid by taking out the things you do not want. The kidneys do this to the blood.' }
  ],
  H: [
    { type: 'contains', word: 'Urethra', clue: 'The tube that carries urine from the bladder out of the body.' },
    { type: 'contains', word: 'Urethra', clue: 'The last part of the system. Urine leaves the body through this tube.' }
  ],
  K: [
    { type: 'starts', word: 'Kidneys', clue: 'Two organs shaped like beans, near your back, one on each side, tucked under the bottom of your ribs.' },
    { type: 'starts', word: 'Kidneys', clue: 'The two organs that filter the blood and make urine.' }
  ],
  R: [
    { type: 'contains', word: 'Ureters', clue: 'The two thin tubes that carry urine from the kidneys to the bladder.' },
    { type: 'contains', word: 'Ureters', clue: 'There are two of these tubes. Each one connects a kidney to the bladder.' }
  ],
  U: [
    { type: 'starts', word: 'Urine', clue: 'The yellow liquid made by the kidneys. It is water mixed with waste.' },
    { type: 'starts', word: 'Urinary system', clue: 'The kidneys, the ureters, the bladder and the urethra, all together.' }
  ],
  W: [
    { type: 'starts', word: 'Waste', clue: 'Anything the body does not need and has to get rid of. Urine carries it out of the body.' },
    { type: 'starts', word: 'Water', clue: 'Urine is made mostly of this. You should drink lots of it every day.' }
  ]
};

if (typeof module !== 'undefined' && module.exports) module.exports = WORD_BANK;
else self.WORD_BANK = WORD_BANK;
