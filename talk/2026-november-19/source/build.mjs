// Build a self-contained talk HTML: engine, source, KaTeX, and fonts all inline.
// Graphics are loaded by relative path, so keep the HTML in the folder with the figures.
// Usage: node build.mjs talk.tex out/talk.html [--scale=1.0]
import fs from 'node:fs';
import path from 'node:path';

const [srcPath = 'talk.tex', outPath = 'out/talk.html'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const scaleArg = process.argv.find(a => a.startsWith('--scale='));
const scale = scaleArg ? parseFloat(scaleArg.split('=')[1]) : 1.0;

const nm = (p) => path.join('node_modules', p);
const b64 = (p) => fs.readFileSync(p).toString('base64');

// KaTeX CSS with its fonts as data URIs (woff2 only; every current browser reads it)
let katexCss = fs.readFileSync(nm('katex/dist/katex.min.css'), 'utf8');
katexCss = katexCss.replace(/src:url\(fonts\/([^)]+?\.woff2)\) format\("woff2"\)(,url\([^)]*\) format\("[^"]*"\))*/g,
  (m, f) => `src:url(data:font/woff2;base64,${b64(nm('katex/dist/fonts/' + f))}) format("woff2")`);
const katexJs = fs.readFileSync(nm('katex/dist/katex.min.js'), 'utf8');

// Text fonts used by the engine: Spectral and JetBrains Mono
const face = (family, file, weight, style) =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:block;` +
  `src:url(data:font/woff2;base64,${b64(nm(file))}) format("woff2")}`;
const fontCss = [
  face('Spectral', '@fontsource/spectral/files/spectral-latin-400-normal.woff2', 400, 'normal'),
  face('Spectral', '@fontsource/spectral/files/spectral-latin-400-italic.woff2', 400, 'italic'),
  face('Spectral', '@fontsource/spectral/files/spectral-latin-600-normal.woff2', 600, 'normal'),
  face('Spectral', '@fontsource/spectral/files/spectral-latin-600-italic.woff2', 600, 'italic'),
  face('JetBrains Mono', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 400, 'normal'),
  face('JetBrains Mono', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2', 600, 'normal'),
].join('\n');

const engine = fs.readFileSync('talk-engine.js', 'utf8');
const source = fs.readFileSync(srcPath, 'utf8');
const title = (source.match(/^\\title\{(.*)\}\s*$/m) || [, 'Talk'])[1].replace(/\$[^$]*\$/g, '').replace(/[\\{}]/g, '');
const safe = (s) => String(s).replace(/<\/(script)/gi, '<\\/$1');

function PLAYER() {
  var q = null;
  try { q = new URLSearchParams(location.search).get('scale'); } catch (e) { }
  window.Lecture.setScale(q && !isNaN(parseFloat(q)) ? parseFloat(q) : (window.LECTURE_SCALE || 1));
  var stage = document.getElementById('stage');
  function fit() {
    var s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = 'scale(' + s + ')';
    stage.style.left = ((innerWidth - 1920 * s) / 2) + 'px';
    stage.style.top = ((innerHeight - 1080 * s) / 2) + 'px';
  }
  addEventListener('resize', fit); fit();
  var start = 0;
  try { var h = parseInt((location.hash || '').slice(1), 10); if (h > 0) start = h - 1; } catch (e) { }
  var deck = window.Lecture.parse(window.LECTURE_SOURCE);
  // fonts are inline, but wait for them so the first slide is measured with the right metrics
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
    window.Lecture.player(stage, { readonly: true }).setDeck(deck, Math.min(start, deck.slides.length - 1), 0);
  });
}

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="talk-engine 1.0 (from lecture-engine 2.0.0-dev)">
<title>${title}</title>
<style>${fontCss}</style>
<style>${katexCss}</style>
<style>html,body{margin:0;height:100%;background:#fff;overflow:hidden}#wrap{position:fixed;inset:0;overflow:hidden}#stage{position:absolute;top:0;left:0;width:1920px;height:1080px;transform-origin:top left}</style>
<script>${safe(katexJs)}</script>
</head><body><main id="wrap"><div id="stage"></div></main>
<script>window.LECTURE_IMAGES={};window.LECTURE_SOURCE=${safe(JSON.stringify(source))};window.LECTURE_SCALE=${scale};window.LECTURE_THEMES={};</script>
<script>${safe(engine)}</script>
<script>(${PLAYER.toString()})();</script>
</body></html>
`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, html);
console.log(`${outPath}: ${(html.length / 1024).toFixed(0)} KB`);
