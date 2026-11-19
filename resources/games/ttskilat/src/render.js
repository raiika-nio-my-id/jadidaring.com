/* TTS Kilat: DOM rendering of grid, clue lists, on-screen keyboard. window.TTSRender */
(function (root) {
'use strict';
const $ = id => document.getElementById(id);
let pz = null, cells = [], liA = [], liD = [], onCell = null, onClue = null;
const DIRN = ['Mendatar', 'Menurun'];
function mount(p, h) {
  pz = p; onCell = h.onCell; onClue = h.onClue;
  const g = $('grid'); g.innerHTML = ''; g.style.gridTemplateColumns = `repeat(${pz.w}, var(--cell))`; cells = [];
  for (let i = 0; i < pz.w * pz.h; i++) {
    const d = document.createElement('div');
    if (pz.sol[i]) { d.className = 'c on'; d.dataset.i = i; d.setAttribute('role', 'gridcell'); if (pz.nums[i]) { const n = document.createElement('span'); n.className = 'n'; n.textContent = pz.nums[i]; d.appendChild(n); } const t = document.createElement('span'); t.className = 't'; d.appendChild(t); }
    else d.className = 'c';
    g.appendChild(d); cells.push(d);
  }
  g.onpointerdown = e => { const c = e.target.closest('.c.on'); if (c) { e.preventDefault(); onCell(+c.dataset.i); } };
  const mk = (ol, dir) => { const list = $(ol); list.innerHTML = ''; const out = []; pz.words.forEach((w, wi) => { if (w.dir !== dir) return; const li = document.createElement('li'); li.innerHTML = '<b></b><span></span>'; li.firstChild.textContent = w.num; li.lastChild.textContent = w.clue + ' (' + w.ans.length + ')'; li.onclick = () => onClue(wi); list.appendChild(li); out[wi] = li; }); return out; };
  liA = mk('clA', 0); liD = mk('clD', 1);
  fit();
}
function fit() {
  if (!pz) return; const wrap = $('gridWrap'), board = wrap.parentElement, r = board.getBoundingClientRect(), cl = $('clueLists');
  const side = cl && cl.offsetParent ? cl.getBoundingClientRect().width + 24 : 0;
  const aw = Math.max(120, r.width - side) - 8, ah = Math.max(120, r.height) - 8;
  const size = Math.max(22, Math.min(52, Math.floor(Math.min(aw / pz.w, ah / pz.h)) + 1));
  document.documentElement.style.setProperty('--cell', size + 'px');
}
function update(st, cur, dir, wi) {
  const w = pz.words[wi], inW = new Set(w ? w.cells : []), okSet = new Set();
  st.wordsDone.forEach(k => pz.words[k].cells.forEach(c => okSet.add(c)));
  for (let i = 0; i < cells.length; i++) {
    if (!pz.sol[i]) continue; const d = cells[i];
    d.lastChild.textContent = st.fill[i] || '';
    d.classList.toggle('cur', i === cur); d.setAttribute('aria-selected', i === cur ? 'true' : 'false'); d.classList.toggle('w', inW.has(i)); d.classList.toggle('ok', okSet.has(i));
    d.classList.toggle('rev', !!st.rev[i]); d.classList.toggle('bad', !!st.bad[i]);
    d.setAttribute('aria-label', (pz.nums[i] ? pz.nums[i] + ' ' : '') + (st.fill[i] || 'kosong'));
  }
  const tag = w ? `<span class="d">${w.num} ${DIRN[w.dir]}</span>` : '';
  $('clueText').innerHTML = tag + '<span class="q"></span>'; if (w) $('clueText').lastChild.textContent = w.clue + ' (' + w.ans.length + ')';
  pz.words.forEach((x, k) => { const li = (x.dir ? liD : liA)[k]; if (!li) return; li.classList.toggle('act', k === wi); li.classList.toggle('done', st.wordsDone.has(k)); });
  const act = (w && (w.dir ? liD : liA)[wi]); if (act && act.offsetParent) act.scrollIntoView({ block: 'nearest' });
}
function flash(idxs, cls) { idxs.forEach((c, k) => { const d = cells[c]; if (!d) return; d.classList.remove(cls); void d.offsetWidth; d.style.animationDelay = (k * 40) + 'ms'; d.classList.add(cls); setTimeout(() => { d.classList.remove(cls); d.style.animationDelay = ''; }, 600 + k * 40); }); }
function keyboard(onKey) {
  const kb = $('kb'); kb.innerHTML = '';
  ['QWERTYUIOP', 'ASDFGHJKL', '↔ZXCVBNM⌫'].forEach(row => { const r = document.createElement('div'); r.className = 'kr'; for (const ch of row) { const b = document.createElement('button'); b.type = 'button'; b.className = 'k' + (ch === '⌫' || ch === '↔' ? ' wide' : ''); b.textContent = ch; b.dataset.k = ch === '⌫' ? 'BS' : ch === '↔' ? 'DIR' : ch; b.setAttribute('aria-label', ch === '⌫' ? 'Hapus' : ch === '↔' ? 'Ganti arah' : ch); r.appendChild(b); } kb.appendChild(r); });
  kb.onpointerdown = e => { const b = e.target.closest('.k'); if (!b) return; e.preventDefault(); b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 110); onKey(b.dataset.k); };
}
root.TTSRender = { mount, fit, update, flash, keyboard };
})(window);
