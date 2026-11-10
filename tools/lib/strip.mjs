// Comments and indentation out of the page's script, at build time (0.27.11, from the review of 2026-11-09: comments were 17% of the
// script). No dependencies: Vercel's build installs nothing (vercel.json), so this is a small scanner of its own, not a minifier.
// What it does, and only that: drops // and /* */ comments that stand in code, and the indentation of lines that start in code. It never
// touches the inside of a string, a template literal (the GLSL lives there) or a regular expression, never joins lines (a removed block
// comment that held a line break leaves one, so automatic semicolons stay where they were), and never renames or reorders anything.
// It returns the text and what it removed (`comments`, for build.mjs's checks).
const WORD_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
export function stripJS(src){
  // (line ends as LF: a checkout on Windows has CRLF. Inside a template literal JavaScript reads CRLF as LF anyway, and a string cannot
  // hold a raw line break, so nothing the script sees changes)
  src = src.replace(/\r\n?/g, '\n');
  let out = '', i = 0, lineStart = true;
  const n = src.length, comments = [];
  // the last significant thing written in code: decides whether a / starts a regular expression or divides
  let prevKind = 'start', prevWord = '';
  const stack = [];   // template literal nesting: each ${ pushes the brace depth it opened at
  let braceDepth = 0;
  const isIdChar = c => /[A-Za-z0-9_$\u0080-￿]/.test(c);
  const regexAllowed = () => prevKind === 'start' || prevKind === 'punct' || (prevKind === 'word' && WORD_BEFORE_REGEX.has(prevWord));
  function readString(q){   // from the opening quote; returns the end index (after the closing quote)
    let j = i + 1;
    while (j < n){ const c = src[j]; if (c === '\\'){ j += 2; continue; } if (c === q) return j + 1; if (c === '\n') throw new Error('line break in a string at ' + j); j++; }
    throw new Error('unclosed string at ' + i);
  }
  function readRegex(){   // from the opening /
    let j = i + 1, cls = false;
    while (j < n){ const c = src[j];
      if (c === '\\'){ j += 2; continue; }
      if (c === '\n') throw new Error('line break in a regular expression at ' + i + ': ' + JSON.stringify(src.slice(i, i + 40)));
      if (cls){ if (c === ']') cls = false; }
      else if (c === '[') cls = true;
      else if (c === '/'){ j++; while (j < n && /[a-z]/.test(src[j])) j++; return j; }
      j++; }
    throw new Error('unclosed regular expression at ' + i);
  }
  // the inside of a template literal, from just after ` (or after the } that closes a ${...}): copied as it is, up to ` or ${
  function readTemplate(){
    let j = i;
    while (j < n){ const c = src[j];
      if (c === '\\'){ j += 2; continue; }
      if (c === '`'){ out += src.slice(i, j + 1); i = j + 1; prevKind = 'value'; return; }
      if (c === '$' && src[j + 1] === '{'){ out += src.slice(i, j + 2); i = j + 2; stack.push(braceDepth); braceDepth++; prevKind = 'punct'; return; }
      j++; }
    throw new Error('unclosed template literal');
  }
  while (i < n){
    const c = src[i];
    if (c === '\n'){ out += '\n'; i++; lineStart = true; continue; }
    if (lineStart && (c === ' ' || c === '\t')){ i++; continue; }   // (indentation of a line that starts in code)
    lineStart = false;
    if (c === '/' && src[i + 1] === '/'){ let j = i; while (j < n && src[j] !== '\n') j++; comments.push(src.slice(i, j)); i = j;
      // (a comment after code on the same line: the spaces before it go too)
      let k = out.length; while (k > 0 && (out[k - 1] === ' ' || out[k - 1] === '\t')) k--; if (k < out.length) out = out.slice(0, k); continue; }
    if (c === '/' && src[i + 1] === '*'){ const j = src.indexOf('*/', i + 2); if (j < 0) throw new Error('unclosed block comment at ' + i);
      const body = src.slice(i, j + 2); comments.push(body); i = j + 2; out += body.includes('\n') ? '\n' : ' '; if (body.includes('\n')) lineStart = true; continue; }
    if (c === '"' || c === "'"){ const j = readString(c); out += src.slice(i, j); i = j; prevKind = 'value'; continue; }
    if (c === '`'){ out += '`'; i++; readTemplate(); continue; }
    if (c === '/' && regexAllowed()){ const j = readRegex(); out += src.slice(i, j); i = j; prevKind = 'value'; continue; }
    if (isIdChar(c)){ let j = i; while (j < n && isIdChar(src[j])) j++; prevWord = src.slice(i, j); prevKind = /^[0-9]/.test(prevWord) ? 'value' : 'word'; out += prevWord; i = j; continue; }
    if (c === '{'){ braceDepth++; out += c; i++; prevKind = 'punct'; continue; }
    if (c === '}'){
      if (stack.length && stack[stack.length - 1] === braceDepth - 1){ stack.pop(); braceDepth--; out += c; i++; readTemplate(); continue; }
      braceDepth--; out += c; i++; prevKind = 'punct'; continue; }   // (after a block a / starts a regular expression; after an object literal it would
                                                                      // divide, which the script never does: the syntax check below would catch it)
    if (c === ')' || c === ']'){ out += c; i++; prevKind = 'value'; continue; }
    if (c === ' ' || c === '\t' || c === '\r'){ out += c; i++; continue; }
    out += c; i++; prevKind = 'punct';
  }
  // blank lines that the removed comments leave
  return { text:out.replace(/\n{2,}/g, '\n'), comments };
}
