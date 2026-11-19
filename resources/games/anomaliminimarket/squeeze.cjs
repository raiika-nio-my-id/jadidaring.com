/* Tiny JS whitespace/comment squeezer for the ship copy. Token-aware: strings, regex literals and comments are
   handled explicitly; every original newline is kept (ASI-safe); a space survives only between two identifier
   chars or where it separates + +, - -, / /. Sources must not use template literals (checked). */
module.exports = function squeeze(src) {
  if (src.includes('`')) throw Error('template literal: squeeze unsafe');
  const idc = c => !!c && (/[A-Za-z0-9_$]/.test(c) || c > '\x7f');
  let out = '', i = 0, sp = false, nl = false;
  const lastSig = () => { let k = out.length - 1; while (k >= 0 && /\s/.test(out[k])) k--; return k; };
  const emit = s => {
    if (nl) out += '\n';
    else if (sp && out.length) { const a = out[out.length - 1], b = s[0]; if ((idc(a) && idc(b)) || (a === b && '+-/'.includes(a))) out += ' '; }
    sp = nl = false; out += s;
  };
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { if (out.length) nl = true; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { sp = true; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) throw Error('open comment'); if (src.slice(i, e).includes('\n')) nl = true; else sp = true; i = e + 2; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n' || j >= n) throw Error('bad string at ' + i); j++; } emit(src.slice(i, j + 1)); i = j + 1; continue; }
    if (c === '/') {
      const k = lastSig(), pc = k >= 0 ? out[k] : '', pre = out.slice(Math.max(0, k - 7), k + 1);
      const isRe = !pc || '(,=:[!&|?{;+-*%<>~^'.includes(pc) || /(^|[^A-Za-z0-9_$])(return|typeof|case|void)$/.test(pre);
      if (isRe) {
        let j = i + 1, cls = false;
        for (;;) { const d = src[j]; if (d === undefined || d === '\n') throw Error('bad regex at ' + i); if (d === '\\') { j += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; j++; }
        j++; while (/[a-z]/.test(src[j] || '')) j++;
        emit(src.slice(i, j)); i = j; continue;
      }
    }
    if (idc(c)) { let j = i; while (j < n && idc(src[j])) j++; emit(src.slice(i, j)); i = j; continue; }
    emit(c); i++;
  }
  return out.replace(/\n+/g, '\n');
};
