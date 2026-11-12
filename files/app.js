/* [level, id, kana, romaji, english, kanji, tag, exampleJp, exampleEn] */

const CARDS = RAW.map(a => ({ lvl: a[0], id: a[1], kana: a[2], ro: a[3], en: a[4], kanji: a[5], tag: a[6], exj: a[7], exe: a[8] }));
const TAGS = { 'i-adj': 'i-adjective', 'na-adj': 'na-adjective', 'adv': 'adverb', 'noun': 'noun', 'noun-modifier': 'noun modifier',
  'existence': 'existence', 'possession': 'possession', 'polite prefix': 'polite prefix', 'respect': 'respectful', 'name of city': 'city name' };

/* ---------- storage (falls back to memory if the browser blocks it) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const defaults = { deck: 'all', order: 'shuffle', filter: 'all', dir: 'jp', kanji: false, ex: true };
let S = Object.assign({}, defaults, store.get('jv:settings', {}));
let known = new Set(store.get('jv:known', []));
let queue = [], idx = 0, flipped = false, busy = false;

const $ = id => document.getElementById(id);
const wrap = $('cardWrap'), card = $('card'), front = $('front'), back = $('back');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const saveSettings = () => store.set('jv:settings', S);
const saveKnown = () => store.set('jv:known', [...known]);

/* ---------- speech ---------- */
const canSpeak = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
let jaVoice = null;
if (canSpeak) {
  const pick = () => { jaVoice = speechSynthesis.getVoices().find(v => /^ja/i.test(v.lang)) || null; };
  pick();
  if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', pick);
} else document.body.classList.add('no-speech');
function speak(text) {
  if (!canSpeak || !text) return;
  const t = text.split('/')[0].replace(/[（(].*?[）)]/g, '').replace(/[～〜・。、…]/g, '');
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'ja-JP'; u.rate = .85;
    if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
  } catch (e) {}
}
const SPEAKER = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

/* ---------- queue ---------- */
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function deckCards() { return CARDS.filter(c => S.deck === 'all' || String(c.lvl) === S.deck); }
function buildQueue() {
  let list = deckCards();
  if (S.filter === 'learning') list = list.filter(c => !known.has(c.id));
  if (S.order === 'shuffle') shuffle(list);
  queue = list; idx = 0;
}

/* ---------- painting ---------- */
function enSize(t) { const n = t.length; return n <= 14 ? 2.6 : n <= 26 ? 2.05 : n <= 48 ? 1.6 : 1.25; }
function jpSize(t) {
  const w = Math.max(200, wrap.clientWidth - 64);
  return Math.max(22, Math.min(84, (w * 0.92) / Math.max(1, [...t].length * 1.02)));
}
function speakBtn(kana) { return canSpeak ? `<button class="speak" data-say="${esc(kana)}" tabindex="-1" aria-label="Hear the pronunciation">${SPEAKER}</button>` : ''; }
function stampHTML(c) {
  const k = known.has(c.id) ? '<span class="known-mark">✓ known</span>' : '';
  return `<div class="stamp jp n${c.lvl}">N${c.lvl}</div>${k}`;
}
function answerHTML(c) {
  const chips = [];
  if (c.tag) chips.push(`<span class="chip">${esc(TAGS[c.tag] || c.tag)}</span>`);
  if (S.kanji && c.kanji) chips.push(`<span class="chip jp">kanji ${esc(c.kanji)}</span>`);
  const ex = (S.ex && c.exj) ? `<div class="example"><div class="ex-jp jp">${esc(c.exj)}</div>${c.exe ? `<div class="ex-en">${esc(c.exe)}</div>` : ''}</div>` : '';
  return { chips: chips.length ? `<div class="chips">${chips.join('')}</div>` : '', ex };
}
function paint() {
  const c = queue[idx];
  if (!c) return;
  const a = answerHTML(c);
  if (S.dir === 'jp') {
    front.innerHTML = `${stampHTML(c)}${speakBtn(c.kana)}
      <div class="word jp" style="font-size:${jpSize(c.kana)}px">${esc(c.kana)}</div>
      <div class="hint">Tap the card to see the meaning</div>`;
    back.innerHTML = `${stampHTML(c)}${speakBtn(c.kana)}
      <div class="mini-jp jp">${esc(c.kana)}</div>
      <div class="answer" style="font-size:${enSize(c.en)}rem">${esc(c.en)}</div>
      <div class="reading"><span>reading</span><b>${esc(c.ro)}</b></div>
      ${a.chips}${a.ex}`;
  } else {
    front.innerHTML = `${stampHTML(c)}
      <div class="word-en" style="font-size:${enSize(c.en)}rem">${esc(c.en)}</div>
      ${c.tag ? `<div class="chips"><span class="chip" style="background:var(--primary-soft);color:var(--primary)">${esc(TAGS[c.tag] || c.tag)}</span></div>` : ''}
      <div class="hint">Tap the card to see the Japanese</div>`;
    back.innerHTML = `${stampHTML(c)}${speakBtn(c.kana)}
      <div class="answer jp" style="font-size:${jpSize(c.kana) / 16}rem">${esc(c.kana)}</div>
      <div class="reading"><span>reading</span><b>${esc(c.ro)}</b></div>
      ${S.kanji && c.kanji ? `<div class="chips"><span class="chip jp">kanji ${esc(c.kanji)}</span></div>` : ''}${a.ex}`;
  }
  back.scrollTop = 0;
  card.setAttribute('aria-label', flipped ? `Answer: ${c.en}. Press to flip back.` : 'Flashcard. Press to flip.');
}
let lastKnownCount = -1;
function updateStats() {
  const list = deckCards();
  const k = list.filter(c => known.has(c.id)).length;
  $('posText').textContent = queue.length ? `Card ${idx + 1} of ${queue.length}` : 'No cards';
  const kt = $('knownText');
  kt.innerHTML = `Known <b>${k}</b> of ${list.length}`;
  if (lastKnownCount !== -1 && k > lastKnownCount) { kt.classList.remove('bump'); void kt.offsetWidth; kt.classList.add('bump'); }
  lastKnownCount = k;
  const pct = list.length ? Math.round(k / list.length * 100) : 0;
  $('barFill').style.width = pct + '%';
  $('barA11y').setAttribute('aria-valuenow', pct);
}
function showEmpty(on) {
  $('empty').hidden = !on; wrap.hidden = on;
  $('dock').hidden = on;
}
function render() {
  showEmpty(!queue.length);
  updateStats();
  if (queue.length) { setFlipped(false, true); paint(); }
}
function setFlipped(v, instant) {
  flipped = v;
  if (instant) { card.classList.add('noanim'); }
  card.classList.toggle('flipped', v);
  if (instant) { void card.offsetWidth; card.classList.remove('noanim'); }
  const c = queue[idx];
  if (c) card.setAttribute('aria-label', v ? `Answer: ${c.en}. Press to flip back.` : 'Flashcard. Press to flip.');
}

/* animated change of card */
function change(mutate, step) {
  if (busy) return;
  busy = true;
  const out = step >= 0 ? 'out-l' : 'out-r', inn = step >= 0 ? 'in-r' : 'in-l';
  wrap.classList.add(out);
  setTimeout(() => {
    wrap.classList.remove(out);
    mutate();
    if (!queue.length) { showEmpty(true); updateStats(); busy = false; return; }
    setFlipped(false, true);
    paint(); updateStats();
    wrap.classList.add(inn);
    setTimeout(() => { wrap.classList.remove(inn); busy = false; }, 300);
  }, 170);
}
const go = step => { if (queue.length > 1) change(() => { idx = (idx + step + queue.length) % queue.length; }, step); };
function mark(good) {
  const c = queue[idx];
  if (!c || busy) return;
  if (good) known.add(c.id); else known.delete(c.id);
  saveKnown();
  if (good && S.filter === 'learning') {
    change(() => { queue.splice(idx, 1); if (idx >= queue.length) idx = 0; }, 1);
  } else if (queue.length > 1) {
    change(() => { idx = (idx + 1) % queue.length; }, 1);
  } else { updateStats(); paint(); }
}

/* ---------- events ---------- */
card.addEventListener('click', e => {
  if (swiped) return;
  const sp = e.target.closest('.speak');
  if (sp) { e.stopPropagation(); speak(sp.dataset.say); return; }
  if (!busy) setFlipped(!flipped);
});
/* swipe left or right to change cards (touch screens) */
let tx = 0, ty = 0, tracking = false, swiped = false;
card.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) { tracking = false; return; }
  tracking = true; tx = e.touches[0].clientX; ty = e.touches[0].clientY;
}, { passive: true });
card.addEventListener('touchend', e => {
  if (!tracking) return;
  tracking = false;
  const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    swiped = true; setTimeout(() => { swiped = false; }, 350);
    go(dx < 0 ? 1 : -1);
  }
}, { passive: true });
card.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });

$('prev').onclick = () => go(-1);
$('next').onclick = () => go(1);
$('good').onclick = () => mark(true);
$('again').onclick = () => mark(false);
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (document.body.classList.contains('intro-open')) {
    if (pickerOn) { if (e.key === '1') start('vocab'); else if (e.key === '2') start('kanji'); return; }
    if ((e.code === 'Space' || e.key === 'Enter') && !(e.target.closest && e.target.closest('a'))) { e.preventDefault(); introAdvance(); }
    return;
  }
  if (document.body.classList.contains('kmode')) return;
  const onControl = e.target.closest && e.target.closest('button, [role="switch"], [role="tab"], input');
  if ((e.code === 'Space' || e.key === 'Enter') && (e.target === card || !onControl)) {
    e.preventDefault(); if (queue.length && !busy) setFlipped(!flipped); return;
  }
  if (e.key === 'ArrowRight') { go(1); }
  else if (e.key === 'ArrowLeft') { go(-1); }
  else if (e.key === '1') { mark(false); }
  else if (e.key === '2') { mark(true); }
  else if (e.key === 's' || e.key === 'S') { const c = queue[idx]; if (c) speak(c.kana); }
});

/* deck tabs */
function syncDecks() {
  document.querySelectorAll('#app .deck').forEach(b => b.setAttribute('aria-selected', String(b.dataset.deck === S.deck)));
}
document.querySelectorAll('#app .deck').forEach(b => b.onclick = () => {
  if (S.deck === b.dataset.deck) return;
  S.deck = b.dataset.deck; saveSettings(); syncDecks(); lastKnownCount = -1; buildQueue(); render();
});

/* options panel */
const optBtn = $('optBtn'), optWrap = $('optPanelWrap');
optBtn.onclick = () => {
  const open = !optWrap.classList.contains('open');
  optWrap.classList.toggle('open', open);
  optBtn.setAttribute('aria-expanded', String(open));
};
function syncOptions() {
  document.querySelectorAll('#app .seg').forEach(seg => {
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(S[seg.dataset.key] === b.dataset.v)));
  });
  document.querySelectorAll('#app .switch').forEach(sw => sw.setAttribute('aria-checked', String(!!S[sw.dataset.key])));
}
document.querySelectorAll('#app .seg button').forEach(b => b.onclick = () => {
  const key = b.parentElement.dataset.key;
  if (S[key] === b.dataset.v) return;
  S[key] = b.dataset.v; saveSettings(); syncOptions();
  if (key === 'dir') { const f = flipped; paint(); setFlipped(false, true); }
  else { buildQueue(); render(); }
});
document.querySelectorAll('#app .switch').forEach(sw => sw.onclick = () => {
  const key = sw.dataset.key; S[key] = !S[key]; saveSettings(); syncOptions();
  if (queue.length) paint();
});
$('reshuffle').onclick = () => { S.order = 'shuffle'; saveSettings(); syncOptions(); buildQueue(); render(); };
let resetTimer = null;
$('reset').onclick = e => {
  const b = e.currentTarget;
  if (!resetTimer) {
    b.textContent = 'Tap again to confirm';
    resetTimer = setTimeout(() => { b.textContent = 'Reset progress'; resetTimer = null; }, 3000);
    return;
  }
  clearTimeout(resetTimer); resetTimer = null; b.textContent = 'Progress reset';
  setTimeout(() => { b.textContent = 'Reset progress'; }, 1500);
  known.clear(); saveKnown(); lastKnownCount = -1; buildQueue(); render();
};
$('showAll').onclick = () => { S.filter = 'all'; saveSettings(); syncOptions(); buildQueue(); render(); };

let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (queue.length) paint(); }, 120); });

/* ---------- kanji mode ---------- */
/* [kanji, level, lessonNo, lessonName, meaning, [on-yomi], [kun-yomi], [[word, reading, meaning, special?]]] */
const KCARDS = KRAW.map(a => ({ id: 'k-' + a[0], ch: a[0], lvl: a[1], ln: a[2], lname: a[3], en: a[4], on: a[5], kun: a[6], words: a[7] }));

const K = (() => {
  const g = id => document.getElementById(id);
  const wrap = g('kCardWrap'), card = g('kCard'), front = g('kFront'), back = g('kBack');
  const defaults = { deck: 'all', lesson: 'all', order: 'shuffle', filter: 'all', dir: 'jp', ex: true };
  let S = Object.assign({}, defaults, store.get('jk:settings', {}));
  let known = new Set(store.get('jk:known', []));
  let queue = [], idx = 0, flipped = false, busy = false, lastKnown = -1, swiped = false;
  const save = () => store.set('jk:settings', S);
  const saveKnown = () => store.set('jk:known', [...known]);

  const kata = s => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
  const spaced = s => s.replace(/\//g, ' / ');
  const pool = () => KCARDS.filter(c => (S.deck === 'all' || String(c.lvl) === S.deck) && (S.lesson === 'all' || (c.lvl + '-' + c.ln) === S.lesson));

  function buildQueue() {
    let list = pool();
    if (S.filter === 'learning') list = list.filter(c => !known.has(c.id));
    if (S.order === 'shuffle') shuffle(list);
    queue = list; idx = 0;
  }

  /* ----- html pieces ----- */
  function kunHTML(k) {
    const i = k.indexOf('-');
    return i < 0 ? esc(k) : esc(k.slice(0, i)) + '<span class="ok">' + esc(k.slice(i + 1)) + '</span>';
  }
  function readingsHTML(c) {
    const on = c.on.filter(x => x !== '-'), kun = c.kun.filter(x => x !== '-');
    const chips = (arr, fn) => arr.length ? arr.map(x => `<span class="rchip jp">${fn(x)}</span>`).join('') : '<span class="rnone">none</span>';
    return `<div class="rd-row">
      <div class="rd"><span class="rl">音 on-yomi</span><div class="rchips">${chips(on, x => esc(kata(x.replace(/[()]/g, ''))))}</div></div>
      <div class="rd"><span class="rl">訓 kun-yomi</span><div class="rchips">${chips(kun, kunHTML)}</div></div>
    </div>`;
  }
  function wordsHTML(c) {
    if (!S.ex || !c.words.length) return '';
    return `<div class="kwords">${c.words.map(w =>
      `<button class="kw" tabindex="-1" data-say="${esc(w[1])}" aria-label="Hear ${esc(w[0])}"><span class="kw-w jp">${esc(w[0])}</span><span class="kw-r jp">${esc(w[1].replace(/\//g, ' / '))}</span><span class="kw-m">${esc(w[2])}</span>${w[3] ? '<span class="kw-i" title="Special (irregular) reading">special</span>' : ''}</button>`
    ).join('')}</div>`;
  }
  function bigSize() {
    const w = wrap.clientWidth || 320, h = card.clientHeight || 340;
    return Math.round(Math.max(80, Math.min(w * .56, h * .5, 240)));
  }

  function paint() {
    const c = queue[idx];
    if (!c) return;
    const stamp = `<div class="stamp jp n${c.lvl}">N${c.lvl}</div>${known.has(c.id) ? '<span class="known-mark">✓ known</span>' : ''}`;
    const lesson = `<div class="chips"><span class="chip">Lesson ${c.ln} · ${esc(c.lname)}</span></div>`;
    const first = c.words[0] ? c.words[0][1] : '';
    const sp = (canSpeak && first) ? `<button class="speak" data-say="${esc(first)}" tabindex="-1" aria-label="Hear an example word">${SPEAKER}</button>` : '';
    if (S.dir === 'jp') {
      front.innerHTML = `${stamp}
        <div class="word kbig jp" style="font-size:${bigSize()}px">${esc(c.ch)}</div>
        <div class="hint">Tap the card to see the meaning and readings</div>`;
      const cw = back.clientWidth || 320;
      const colW = Math.max(100, (cw - 62) / 2.1);
      const longest = Math.min(10, Math.max(4, ...c.en.split(/[\/\s]+/).map(x => x.length)));
      let fs = colW / (0.95 * longest); if (c.en.length > 16) fs *= .85;
      fs = Math.round(Math.max(18, Math.min(54, fs)));
      const kfs = Math.round(Math.max(36, Math.min(80, cw * .13)));
      back.innerHTML = `${stamp}${sp}
        <div class="ktop">
          <div class="kleft">
            <div class="kmini jp" style="font-size:${kfs}px">${esc(c.ch)}</div>
            <div class="answer kans" style="font-size:${fs}px">${esc(spaced(c.en))}</div>
            ${lesson}
          </div>
          <div class="kright">${readingsHTML(c)}</div>
        </div>
        ${wordsHTML(c)}`;
    } else {
      front.innerHTML = `${stamp}
        <div class="word-en" style="font-size:${enSize(c.en)}rem">${esc(spaced(c.en))}</div>
        <div class="hint">Tap the card to see the kanji</div>`;
      back.innerHTML = `${stamp}${sp}
        <div class="ktop">
          <div class="kleft">
            <div class="answer kbig jp" style="font-size:${Math.round(Math.min(110, Math.max(56, ((back.clientWidth || 320) - 62) / 2.1 * .8)))}px">${esc(c.ch)}</div>
            ${lesson}
          </div>
          <div class="kright">${readingsHTML(c)}</div>
        </div>
        ${wordsHTML(c)}`;
    }
    back.scrollTop = 0;
    card.setAttribute('aria-label', flipped ? `Answer: ${c.en}. Press to flip back.` : 'Kanji flashcard. Press to flip.');
  }

  function updateStats() {
    const list = pool();
    const k = list.filter(c => known.has(c.id)).length;
    g('kPosText').textContent = queue.length ? `Card ${idx + 1} of ${queue.length}` : 'No cards';
    const kt = g('kKnownText');
    kt.innerHTML = `Known <b>${k}</b> of ${list.length}`;
    if (lastKnown !== -1 && k > lastKnown) { kt.classList.remove('bump'); void kt.offsetWidth; kt.classList.add('bump'); }
    lastKnown = k;
    const pct = list.length ? Math.round(k / list.length * 100) : 0;
    g('kBarFill').style.width = pct + '%';
    g('kBarA11y').setAttribute('aria-valuenow', pct);
  }
  function showEmpty(on) { g('kEmpty').hidden = !on; wrap.hidden = on; g('kDock').hidden = on; }
  function setFlipped(v, instant) {
    flipped = v;
    if (instant) card.classList.add('noanim');
    card.classList.toggle('flipped', v);
    if (instant) { void card.offsetWidth; card.classList.remove('noanim'); }
    const c = queue[idx];
    if (c) card.setAttribute('aria-label', v ? `Answer: ${c.en}. Press to flip back.` : 'Kanji flashcard. Press to flip.');
  }
  function render() {
    showEmpty(!queue.length);
    updateStats();
    if (queue.length) { setFlipped(false, true); paint(); }
  }

  function change(mutate, step) {
    if (busy) return;
    busy = true;
    const out = step >= 0 ? 'out-l' : 'out-r', inn = step >= 0 ? 'in-r' : 'in-l';
    wrap.classList.add(out);
    setTimeout(() => {
      wrap.classList.remove(out);
      mutate();
      if (!queue.length) { showEmpty(true); updateStats(); busy = false; return; }
      setFlipped(false, true);
      paint(); updateStats();
      wrap.classList.add(inn);
      setTimeout(() => { wrap.classList.remove(inn); busy = false; }, 300);
    }, 170);
  }
  const go = step => { if (queue.length > 1) change(() => { idx = (idx + step + queue.length) % queue.length; }, step); };
  function mark(good) {
    const c = queue[idx];
    if (!c || busy) return;
    if (good) known.add(c.id); else known.delete(c.id);
    saveKnown();
    if (good && S.filter === 'learning') {
      change(() => { queue.splice(idx, 1); if (idx >= queue.length) idx = 0; }, 1);
    } else if (queue.length > 1) {
      change(() => { idx = (idx + 1) % queue.length; }, 1);
    } else { updateStats(); paint(); }
  }

  /* ----- controls sync ----- */
  function buildLessonSelect() {
    const sel = g('kLesson');
    const levels = S.deck === 'all' ? [5, 4] : [Number(S.deck)];
    let html = '<option value="all">All lessons</option>';
    levels.forEach(L => {
      const seen = [];
      KCARDS.filter(c => c.lvl === L).forEach(c => { if (!seen.includes(c.ln)) seen.push(c.ln); });
      html += `<optgroup label="N${L}">` + seen.map(n => {
        const list = KCARDS.filter(c => c.lvl === L && c.ln === n);
        return `<option value="${L}-${n}">N${L} · Lesson ${n} · ${esc(list[0].lname)} (${list.length})</option>`;
      }).join('') + '</optgroup>';
    });
    sel.innerHTML = html;
    if (![...sel.options].some(o => o.value === S.lesson)) S.lesson = 'all';
    sel.value = S.lesson;
  }
  function syncAll() {
    document.querySelectorAll('#kDecks .deck').forEach(b => b.setAttribute('aria-selected', String(b.dataset.deck === S.deck)));
    document.querySelectorAll('#kOptPanel .seg').forEach(seg => seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(S[seg.dataset.key] === b.dataset.v))));
    document.querySelectorAll('#kOptPanel .switch').forEach(sw => sw.setAttribute('aria-checked', String(!!S[sw.dataset.key])));
    g('kLesson').value = S.lesson;
  }
  function rebuild() { lastKnown = -1; buildQueue(); render(); }

  /* ----- events ----- */
  card.addEventListener('click', e => {
    if (swiped) return;
    const sp = e.target.closest('.speak, .kw');
    if (sp) { e.stopPropagation(); speak(sp.dataset.say); return; }
    if (!busy) setFlipped(!flipped);
  });
  let tx = 0, ty = 0, tracking = false;
  card.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { tracking = false; return; }
    tracking = true; tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }, { passive: true });
  card.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swiped = true; setTimeout(() => { swiped = false; }, 350);
      go(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
  card.addEventListener('touchcancel', () => { tracking = false; }, { passive: true });

  g('kPrev').onclick = () => go(-1);
  g('kNext').onclick = () => go(1);
  g('kGood').onclick = () => mark(true);
  g('kAgain').onclick = () => mark(false);

  document.addEventListener('keydown', e => {
    const b = document.body;
    if (!b.classList.contains('kmode') || b.classList.contains('intro-open')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target, closest = sel => t.closest && t.closest(sel);
    if (closest('select')) return;
    const onControl = closest('button, [role="switch"], [role="tab"], input');
    if ((e.code === 'Space' || e.key === 'Enter') && (t === card || !onControl)) {
      e.preventDefault(); if (queue.length && !busy) setFlipped(!flipped); return;
    }
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === '1') mark(false);
    else if (e.key === '2') mark(true);
    else if (e.key === 's' || e.key === 'S') { const c = queue[idx]; if (c && c.words[0]) speak(c.words[0][1]); }
  });

  document.querySelectorAll('#kDecks .deck').forEach(b => b.onclick = () => {
    if (S.deck === b.dataset.deck) return;
    S.deck = b.dataset.deck; S.lesson = 'all'; save();
    buildLessonSelect(); syncAll(); rebuild();
  });
  g('kLesson').onchange = e => { S.lesson = e.target.value; save(); rebuild(); };

  const optBtn = g('kOptBtn'), optWrap = g('kOptPanelWrap');
  optBtn.onclick = () => {
    const open = !optWrap.classList.contains('open');
    optWrap.classList.toggle('open', open);
    optBtn.setAttribute('aria-expanded', String(open));
  };
  document.querySelectorAll('#kOptPanel .seg button').forEach(b => b.onclick = () => {
    const key = b.parentElement.dataset.key;
    if (S[key] === b.dataset.v) return;
    S[key] = b.dataset.v; save(); syncAll();
    if (key === 'dir') { paint(); setFlipped(false, true); } else rebuild();
  });
  document.querySelectorAll('#kOptPanel .switch').forEach(sw => sw.onclick = () => {
    const key = sw.dataset.key; S[key] = !S[key]; save(); syncAll();
    if (queue.length) paint();
  });
  g('kReshuffle').onclick = () => { S.order = 'shuffle'; save(); syncAll(); rebuild(); };
  let resetTimer = null;
  g('kReset').onclick = e => {
    const b = e.currentTarget;
    if (!resetTimer) {
      b.textContent = 'Tap again to confirm';
      resetTimer = setTimeout(() => { b.textContent = 'Reset progress'; resetTimer = null; }, 3000);
      return;
    }
    clearTimeout(resetTimer); resetTimer = null; b.textContent = 'Progress reset';
    setTimeout(() => { b.textContent = 'Reset progress'; }, 1500);
    known.clear(); saveKnown(); rebuild();
  };
  g('kShowAll').onclick = () => { S.filter = 'all'; save(); syncAll(); rebuild(); };

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (document.body.classList.contains('kmode') && queue.length) paint(); }, 120);
  });

  /* ----- init ----- */
  const n5 = KCARDS.filter(c => c.lvl === 5).length, n4 = KCARDS.filter(c => c.lvl === 4).length;
  g('kcAll').textContent = KCARDS.length; g('kc5').textContent = n5; g('kc4').textContent = n4;
  g('introK').textContent = KCARDS.length; g('modeK').textContent = KCARDS.length;
  g('modeV').textContent = CARDS.length.toLocaleString('en-US');
  buildLessonSelect(); syncAll(); buildQueue(); render();

  return {
    show() { syncAll(); requestAnimationFrame(() => { if (queue.length) paint(); }); }
  };
})();

/* ---------- intro ---------- */
function makePetals(el, n) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span'); p.className = 'petal';
    p.style.cssText = `--x:${Math.round(Math.random() * 100)}%;--s:${9 + Math.round(Math.random() * 8)}px;--d:${16 + Math.round(Math.random() * 14)}s;--dl:${-Math.round(Math.random() * 28)}s;--dx:${(Math.random() * 160 - 80).toFixed(0)}px`;
    el.appendChild(p);
  }
}
/* mode picker: tap to start -> choose Vocab or Kanji */
let pickerOn = false;
function showPicker(on) {
  pickerOn = on;
  $('startBtn').hidden = on;
  $('modes').hidden = !on;
  if (on) { const f = document.querySelector('#modes .mode'); if (f) f.focus({ preventScroll: true }); }
}
function introAdvance() { if (!pickerOn) showPicker(true); }
function start(mode) {
  const k = mode === 'kanji', intro = $('intro');
  document.body.classList.toggle('kmode', k);
  $('app').hidden = k; $('kapp').hidden = !k;
  $('app').toggleAttribute('inert', k); $('kapp').toggleAttribute('inert', !k);
  document.body.classList.add('started');
  intro.classList.add('leaving');
  requestAnimationFrame(() => { if (k) K.show(); else if (queue.length) paint(); });
  setTimeout(() => {
    if (!document.body.classList.contains('started')) return;
    intro.hidden = true;
    document.body.classList.remove('intro-open');
  }, 700);
}
function goMenu() {
  const intro = $('intro');
  document.body.classList.remove('started', 'kmode');
  document.body.classList.add('intro-open');
  $('app').setAttribute('inert', ''); $('kapp').setAttribute('inert', '');
  intro.hidden = false; intro.scrollTop = 0; void intro.offsetWidth;
  intro.classList.remove('leaving');
  showPicker(true);
}
$('startBtn').addEventListener('click', e => { e.stopPropagation(); introAdvance(); });
$('intro').addEventListener('click', e => { if (e.target.closest('.credit, .modes')) return; introAdvance(); });
document.querySelectorAll('#modes .mode').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); start(b.dataset.mode); }));
$('menuBtn').addEventListener('click', goMenu);
$('kMenuBtn').addEventListener('click', goMenu);

/* ---------- init ---------- */
(function init() {
  const n5 = CARDS.filter(c => c.lvl === 5).length, n4 = CARDS.filter(c => c.lvl === 4).length;
  $('cAll').textContent = CARDS.length; $('c5').textContent = n5; $('c4').textContent = n4;
  makePetals($('petals'), 9); makePetals($('introPetals'), 12);
  $('introN5').textContent = n5.toLocaleString('en-US'); $('introN4').textContent = n4.toLocaleString('en-US');
  syncDecks(); syncOptions(); buildQueue(); render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (queue.length) paint(); });
})();
