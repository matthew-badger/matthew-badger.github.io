r"""Derive talk-engine.js from lecture-engine-v2.js.

Additions (everything else is the v2 engine unchanged):
  * \newcommand{\name}[n]{body} preamble lines become KaTeX macros for the deck;
  * \includegraphics<spec>[width=..,height=..,alt=".."]{file} block, loading file by relative path;
  * player keys: digits then g jumps to that slide; c toggles an elapsed-time clock in the tray.
"""
import re, sys

src = open('lecture-engine-v2.js', encoding='utf-8').read()

def sub(old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit('expected %d occurrence(s), found %d:\n%s' % (count, n, old[:200]))
    src = src.replace(old, new)

sub("/* Lecture engine v2 — LaTeX-ish source -> slides, overlays, animated plots.",
    "/* Talk engine 1.0, derived from lecture engine v2 (2.0.0-dev) — adds \\newcommand macros,\n"
    "   \\includegraphics with relative paths, slide jumps (digits + g), and an elapsed clock (c).\n"
    "   Lecture engine v2 — LaTeX-ish source -> slides, overlays, animated plots.")

# deck macros for KaTeX
sub("  /* ---------- KaTeX ---------- */\n",
    "  /* ---------- KaTeX ---------- */\n"
    "  var DECK_MACROS = {};\n")
sub("macros: { '\\\\R': '\\\\mathbb{R}', '\\\\dd': '\\\\mathrm{d}', '\\\\eps': '\\\\varepsilon' }",
    "macros: Object.assign({ '\\\\R': '\\\\mathbb{R}', '\\\\dd': '\\\\mathrm{d}', '\\\\eps': '\\\\varepsilon' }, DECK_MACROS)")

# preamble: \newcommand
sub("""      if ((m = t.match(/^\\\\begin\\{theme\\}\\{([^}]*)\\}\\s*$/))) {
        var tname""",
    """      if ((m = t.match(/^\\\\(?:re)?newcommand\\{?(\\\\[A-Za-z]+)\\}?(?:\\[(\\d)\\])?\\{([\\s\\S]*)\\}\\s*$/))) {
        DECK_MACROS[m[1]] = m[3]; i++; continue;
      }
      if ((m = t.match(/^\\\\begin\\{theme\\}\\{([^}]*)\\}\\s*$/))) {
        var tname""")
sub("""        if (/^\\\\(slide|frame|frametitle|section|titleslide)\\b/.test(s2) || /^\\\\begin\\{theme\\}/.test(s2)) break;""",
    """        if (/^\\\\(slide|frame|frametitle|section|titleslide|newcommand|renewcommand)\\b/.test(s2) || /^\\\\begin\\{theme\\}/.test(s2)) break;""")
sub("""    var lectureThemes = {};
""", """    var lectureThemes = {};
    DECK_MACROS = {};
""")

# \includegraphics block
sub("""      if ((m = t.match(/^\\\\imageslot\\{([^}]*)\\}\\s*(?:\\{([\\s\\S]*)\\})?\\s*$/))) {""",
    """      if ((m = t.match(/^\\\\includegraphics\\s*(?:<([^>]*)>)?\\s*(?:\\[([^\\]]*)\\])?\\s*\\{([^}]*)\\}\\s*$/))) {
        var rg = interval(st, m[1]), go_ = options(m[2] || '');
        use(st, 'image', rg.from, rg.to);
        blocks.push({ type: 'graphic', file: m[3].trim(), width: go_.kv.width || '', height: go_.kv.height || '',
          alt: go_.kv.alt || '', from: rg.from, to: rg.to }); i++; continue;
      }
      if ((m = t.match(/^\\\\imageslot\\{([^}]*)\\}\\s*(?:\\{([\\s\\S]*)\\})?\\s*$/))) {""")
sub("""        if (s3 === '' || s3 === '\\\\pause' || /^\\\\(begin|imageslot|medskip|bigskip|vfill|steps|heading|vspace|timer)\\b/.test(s3)) break;""",
    """        if (s3 === '' || s3 === '\\\\pause' || /^\\\\(begin|imageslot|includegraphics|medskip|bigskip|vfill|steps|heading|vspace|timer)\\b/.test(s3)) break;""")
sub("""      case 'image':
        return '<figure class="lec-imageslot\"""",
    """      case 'graphic':
        return '<figure class="lec-graphic"' + gate(b.from, b.to) + '><img src="' + escAttr(b.file) + '" alt="' + escAttr(b.alt) +
          '" style="display:block;margin:0 auto;max-width:100%;' + (b.width ? 'width:' + escAttr(b.width) + 'px;' : '') +
          (b.height ? 'height:' + escAttr(b.height) + 'px;' : '') + (b.width && b.height ? 'object-fit:contain;' : '') + '"></figure>';
      case 'image':
        return '<figure class="lec-imageslot\"""")
sub("""    '.lec-imageslot{margin:8px 0 20px}',""",
    """    '.lec-imageslot{margin:8px 0 20px}',
    '.lec-graphic{margin:8px 0 20px}',""")

# player: digits + g jumps, c toggles a clock
sub("""      else if (e.key === 't') { if (ctrl && ctrl.toggleTimers()) e.preventDefault(); }""",
    """      else if (/^[0-9]$/.test(e.key)) { typed = (typed + e.key).slice(-3); return; }
      else if (e.key === 'g') { e.preventDefault(); if (typed) jump(clamp(parseInt(typed, 10) - 1, 0, slides.length - 1)); }
      else if (e.key === 'c') { e.preventDefault(); clockOn = !clockOn; if (clockOn && !clockStart) clockStart = Date.now(); chrome(); }
      else if (e.key === 't') { if (ctrl && ctrl.toggleTimers()) e.preventDefault(); }""")
sub("""    function onKey(e) {
      if (opts.keysEnabled""",
    """    var typed = '', clockOn = false, clockStart = 0;
    setInterval(function () { if (clockOn) chrome(); }, 1000);
    function onKey(e) {
      if (!/^[0-9g]$/.test(e.key)) typed = '';
      if (opts.keysEnabled""")
sub("""      counter.textContent = (si + 1) + ' / ' + n;""",
    """      var el = clockStart ? Math.floor((Date.now() - clockStart) / 1000) : 0;
      counter.textContent = (si + 1) + ' / ' + n + (clockOn ? '  \\u00b7  ' + Math.floor(el / 60) + ':' + ('0' + el % 60).slice(-2) : '');""")

# labeled boxes: lemma, proposition, corollary, principle, conjecture, challenge
sub("""    if (env === 'theorem' || env === 'definition' || env === 'example' || env === 'note' || env === 'proof' ||
        env === 'question' || env === 'box') {""",
    """    var ALIAS = { lemma: ['theorem', 'Lemma'], proposition: ['theorem', 'Proposition'], corollary: ['theorem', 'Corollary'],
      principle: ['note', 'Principle'], conjecture: ['note', 'Conjecture'], challenge: ['question', 'Challenge'],
      openproblem: ['question', 'Open problem'] };
    var boxLabel = '';
    if (ALIAS[env]) { boxLabel = ALIAS[env][1]; env = ALIAS[env][0]; }
    if (env === 'theorem' || env === 'definition' || env === 'example' || env === 'note' || env === 'proof' ||
        env === 'question' || env === 'box') {""")
sub("""      return { type: 'box', kind: env, name: arg, blocks: inner, from: from };""",
    """      return { type: 'box', kind: env, label: boxLabel, name: arg, blocks: inner, from: from };""")
sub("""          '<div class="lec-box-label">' + (titles[b.kind] || esc(b.kind)) +""",
    """          '<div class="lec-box-label">' + (b.label ? esc(b.label) : (titles[b.kind] || esc(b.kind))) +""")

# ---- per-slide autofit and vertical spreading ----
# deck: \autofit{1.5} lets each body slide's type grow up to that scale while its tallest step fits;
#       \spread{on} spaces the top-level blocks evenly down the slide.
# slide options: maxscale=1.3 (cap for this slide; maxscale=0 turns growth off), spread=off.
sub("""      if ((m = t.match(/^\\\\(title|subtitle|date|author|copyright|course|engine|footer|slidenumbers|progressbar|theme)\\{([\\s\\S]*?)\\}?$/))) {""",
    """      if ((m = t.match(/^\\\\(title|subtitle|date|author|copyright|course|engine|footer|slidenumbers|progressbar|theme|autofit|spread)\\{([\\s\\S]*?)\\}?$/))) {""")
sub("""        if (/^\\\\(title|subtitle|date|author|copyright|course|engine|footer|slidenumbers|progressbar|theme)\\{/.test(s2)) break;""",
    """        if (/^\\\\(title|subtitle|date|author|copyright|course|engine|footer|slidenumbers|progressbar|theme|autofit|spread)\\{/.test(s2)) break;""")
sub("""      else if (key === 'align' && /^(left|center|right)$/.test(v)) out.align = v;""",
    """      else if (key === 'align' && /^(left|center|right)$/.test(v)) out.align = v;
      else if (key === 'maxscale' && isFinite(numExpr(v, NaN))) out.maxscale = numExpr(v, NaN);
      else if (key === 'spread' && /^(on|off)$/.test(v)) out.spread = v;""")
sub("""    var open = function (kind) { return '<div class="lec-slide lec-slide--' + kind + '" style="--k:' + k + (vars ? ';' + vars : '') + '">'; };""",
    """    var kmax = o.maxscale != null ? o.maxscale : parseFloat((meta && meta.autofit) || '0') || 0;
    var open = function (kind) {
      return '<div class="lec-slide lec-slide--' + kind + '" data-k0="' + k + '"' +
        (kind === 'body' && kmax > k ? ' data-kmax="' + kmax + '"' : '') +
        ' style="--k:' + k + ';--kt:' + SC + (vars ? ';' + vars : '') + '">';
    };""")
sub("""    var body = 'lec-body' + (fill ? ' lec-body--fill' : '') +""",
    """    var spread = !fill && !o.valign && (o.spread ? o.spread === 'on' : /^on$/i.test((meta && meta.spread) || ''));
    var body = 'lec-body' + (fill ? ' lec-body--fill' : '') + (spread ? ' lec-body--spread' : '') +""")
sub("""    '.lec-h{' + fsz(58) + ';""",
    """    '.lec-h{font-size:max(19px,calc(58px*var(--kt,var(--k,1))));""")
sub("""    '.lec-body--fill{flex:1 1 auto;display:flex;flex-direction:column}',""",
    """    '.lec-body--fill{flex:1 1 auto;display:flex;flex-direction:column}',
    '.lec-body--spread{flex:1 1 auto;display:flex;flex-direction:column;justify-content:space-evenly}',
    '.lec-body.lec-measure{flex:0 0 auto!important}',""")
sub("""        // Size the slide once, for its tallest step. Only \\only content changes the layout.
        var tall = flow.scrollHeight;""",
    """        // Autofit: grow the slide's type until its tallest step fills the body.
        var slideEl0 = container.querySelector('.lec-slide'), bodyEl = flow.firstElementChild;
        var hasOnly = gated.some(function (el) { return el.getAttribute('data-hide') === 'none'; });
        var tallAll = function () {
          // a step whose math or boxes overflow sideways counts as not fitting
          var wide = function () {
            var els = bodyEl.querySelectorAll('.katex-display, .lec-display, .lec-math, .lec-math-line, .lec-box, .lec-col, .lec-p, .lec-item');
            for (var q = 0; q < els.length; q++) if (els[q].scrollWidth > els[q].clientWidth + 2) return true;
            return bodyEl.scrollWidth > bodyEl.clientWidth + 2;
          };
          var hgt = function () { return wide() ? 1e9 : Math.max(bodyEl.scrollHeight, bodyEl.offsetHeight); };
          var t = hgt();
          if (hasOnly) { for (var s = 0; s <= slide.steps; s++) { applyOnly(s); t = Math.max(t, hgt()); } applyOnly(step); }
          return t;
        };
        if (slideEl0 && bodyEl && slideEl0.hasAttribute('data-kmax')) {
          var k0 = parseFloat(slideEl0.getAttribute('data-k0')), kmax = parseFloat(slideEl0.getAttribute('data-kmax'));
          slideEl0.style.setProperty('--k', k0);
          bodyEl.classList.add('lec-measure');
          var lim = flow.clientHeight - 8;
          if (tallAll() < lim) {
            var lo = k0, hi = kmax;
            slideEl0.style.setProperty('--k', hi);
            if (tallAll() <= lim) lo = hi;
            else for (var it = 0; it < 10; it++) {
              var mid = (lo + hi) / 2;
              slideEl0.style.setProperty('--k', mid);
              if (tallAll() <= lim) lo = mid; else hi = mid;
            }
            slideEl0.style.setProperty('--k', Math.floor(lo * 1000) / 1000);
          }
          bodyEl.classList.remove('lec-measure');
          if (opts.onAutofit) opts.onAutofit(parseFloat(slideEl0.style.getPropertyValue('--k')));
        }
        // Size the slide once, for its tallest step. Only \\only content changes the layout.
        var tall = flow.scrollHeight;""")

# measure again when an image finishes loading (its height is unknown before that)
sub("""        if (document.fonts && document.fonts.status !== 'loaded') {
          document.fonts.ready.then(function () { requestAnimationFrame(fitFlow); });
        }""",
    """        if (document.fonts && document.fonts.status !== 'loaded') {
          document.fonts.ready.then(function () { requestAnimationFrame(fitFlow); });
        }
        Array.prototype.forEach.call(container.querySelectorAll('img'), function (im) {
          if (!im.complete) im.addEventListener('load', function () { requestAnimationFrame(fitFlow); }, { once: true });
        });""")

# shrinking widens the layout, which reflows the text shorter; search for the largest scale that fits after reflow
sub("""        if (over > 26) { // ignore the trailing block margin
          k = flow.clientHeight / tall;""",
    """        if (over > 26) { // ignore the trailing block margin
          k = flow.clientHeight / tall;
          if (bodyEl) {
            bodyEl.classList.add('lec-measure');
            var box0 = flow.clientHeight, lo2 = 0.85, hi2 = 1;
            flow.style.width = (100 / lo2) + '%';
            if (tallAll() * lo2 <= box0 + 26) {
              for (var it2 = 0; it2 < 10; it2++) {
                var m2 = (lo2 + hi2) / 2;
                flow.style.width = (100 / m2) + '%';
                if (tallAll() * m2 <= box0 + 26) lo2 = m2; else hi2 = m2;
              }
              k = Math.max(k, Math.floor(lo2 * 1000) / 1000);
            }
            flow.style.width = '';
            bodyEl.classList.remove('lec-measure');
          }""")

# ---- links to labeled slides, with a return button ----
# \slide[label=app-x]{...} names a slide; \goto{app-x}{text} in text is a clickable pill that jumps there;
# after a jump, a "Back to slide N" button (or the key b) returns to the slide and step you came from.
sub("""      else if (key === 'maxscale' && isFinite(numExpr(v, NaN))) out.maxscale = numExpr(v, NaN);""",
    """      else if (key === 'maxscale' && isFinite(numExpr(v, NaN))) out.maxscale = numExpr(v, NaN);
      else if (key === 'label') out.label = o.kv[key];""")
sub("""        var m = /^\\\\textcolor\\{\\s*([^{}]*?)\\s*\\}\\{/.exec(rest);""",
    """        var mg = /^\\\\goto\\{([^{}]*)\\}\\{/.exec(rest);
        if (mg) {
          var og = i + mg[0].length - 1, cg = matchBrace(s, og);
          if (cg >= 0) {
            out += keep('<a class="lec-goto" role="button" tabindex="0" data-goto="' + escAttr(mg[1].trim()) + '">\\u25B8\\u2009') +
              walk(s.slice(og + 1, cg)) + keep('</a>');
            i = cg + 1;
            continue;
          }
        }
        var m = /^\\\\textcolor\\{\\s*([^{}]*?)\\s*\\}\\{/.exec(rest);""")
sub("""    '.lec-graphic{margin:8px 0 20px}',""",
    """    '.lec-graphic{margin:8px 0 20px}',
    '.lec-goto{display:inline-block;font-family:var(--lec-fm);font-size:.6em;letter-spacing:.03em;line-height:1.2;padding:.18em .7em;' +
      'margin:0 .2em;border:2px solid ' + cssv('accent') + ';border-radius:999px;color:' + cssv('accent') + ';cursor:pointer;vertical-align:.12em;white-space:nowrap}',
    '.lec-goto:hover{background:' + cssv('accent') + ';color:#fff}',
    '.lec-return{position:absolute;top:34px;right:120px;z-index:20;font-family:var(--lec-fm);font-size:24px;padding:8px 20px;' +
      'border:2px solid ' + cssv('accent') + ';border-radius:999px;background:#fff;color:' + cssv('accent') + ';cursor:pointer}',
    '.lec-return:hover{background:' + cssv('accent') + ';color:#fff}',""")
sub("""    var slides = [], meta = {}, si = 0, step = 0, ctrl = null;""",
    """    var slides = [], meta = {}, si = 0, step = 0, ctrl = null, backStack = [];
    var retBtn = document.createElement('button');
    retBtn.type = 'button'; retBtn.className = 'lec-return'; retBtn.style.display = 'none';
    root.appendChild(retBtn);
    function goBack() {
      var b = backStack.pop();
      if (!b) return;
      si = clamp(b.si, 0, slides.length - 1); step = clamp(b.step, 0, slides[si].steps); mount();
    }
    retBtn.onclick = function (e) { e.stopPropagation(); goBack(); };
    slideEl.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-goto]') : null;
      if (!a) return;
      var lab = a.getAttribute('data-goto'), k = -1;
      for (var q = 0; q < slides.length; q++) if (slides[q].opts && slides[q].opts.label === lab) { k = q; break; }
      if (k < 0 || k === si) return;
      e.preventDefault(); e.stopPropagation();
      backStack.push({ si: si, step: step });
      si = k; step = 0; mount();
    });""")
sub("""      slideEl.setAttribute('aria-label', 'Slide ' + (si + 1) + ' of ' + n);
    }""",
    """      slideEl.setAttribute('aria-label', 'Slide ' + (si + 1) + ' of ' + n);
      var top = backStack[backStack.length - 1];
      if (top && top.si !== si) { retBtn.style.display = ''; retBtn.textContent = '\\u21A9 Back to slide ' + (top.si + 1); }
      else retBtn.style.display = 'none';
    }""")
sub("""      else if (e.key === 't') { if (ctrl && ctrl.toggleTimers()) e.preventDefault(); }""",
    """      else if (e.key === 'b') { e.preventDefault(); goBack(); }
      else if (e.key === 't') { if (ctrl && ctrl.toggleTimers()) e.preventDefault(); }""")

# ---- appendices: \appendix on its own line; later slides are numbered A1, A2, ... and do not count in the total ----
sub("""      if (t === '\\\\titleslide') { cur = newSlide('', 'title'); i++; continue; }""",
    """      if (t === '\\\\appendix') { inAppendix = true; i++; continue; }
      if (t === '\\\\titleslide') { cur = newSlide('', 'title'); i++; continue; }""")
sub("""      var s = { title: title || '', section: section, kind: kind || 'body', blocks: [], steps: 0, timeline: [], checks: [] };""",
    """      var s = { title: title || '', section: section, kind: kind || 'body', blocks: [], steps: 0, timeline: [], checks: [], appendix: inAppendix };""")
sub("""    var lectureThemes = {};
    DECK_MACROS = {};""","""    var lectureThemes = {};
    var inAppendix = false;
    DECK_MACROS = {};""")
sub("""        if (/^\\\\(slide|frame|frametitle|section|titleslide|newcommand|renewcommand)\\b/.test(s2) || /^\\\\begin\\{theme\\}/.test(s2)) break;""",
    """        if (/^\\\\(slide|frame|frametitle|section|titleslide|newcommand|renewcommand|appendix)\\b/.test(s2) || /^\\\\begin\\{theme\\}/.test(s2)) break;""")
sub("""      counter.textContent = (si + 1) + ' / ' + n + (clockOn ? '  \\u00b7  ' + Math.floor(el / 60) + ':' + ('0' + el % 60).slice(-2) : '');""",
    """      var mainN = mainCount();
      counter.textContent = (slide.appendix ? 'A' + (si - mainN + 1) : (si + 1) + ' / ' + mainN) +
        (clockOn ? '  \\u00b7  ' + Math.floor(el / 60) + ':' + ('0' + el % 60).slice(-2) : '');""")
sub("""      bar.style.width = ((si + 1) / n * 100) + '%';""",
    """      bar.style.width = (slide.appendix ? 100 : (si + 1) / mainN * 100) + '%';""")
sub("""      if (top && top.si !== si) { retBtn.style.display = ''; retBtn.textContent = '\\u21A9 Back to slide ' + (top.si + 1); }""",
    """      if (top && top.si !== si) { retBtn.style.display = ''; retBtn.textContent = '\\u21A9 Back to slide ' + (slides[top.si] && slides[top.si].appendix ? 'A' + (top.si - mainN + 1) : top.si + 1); }""")
sub("""    var slides = [], meta = {}, si = 0, step = 0, ctrl = null, backStack = [];""",
    """    var slides = [], meta = {}, si = 0, step = 0, ctrl = null, backStack = [];
    function mainCount() { var k = 0; while (k < slides.length && !slides[k].appendix) k++; return Math.max(1, k); }""")
sub("""        if (step < slide.steps) { step++; ctrl.setStep(step); changed(); }
        else if (si < slides.length - 1) { si++; step = 0; mount(); }""",
    """        if (step < slide.steps) { step++; ctrl.setStep(step); changed(); }
        else if (si < slides.length - 1) { si++; step = 0; mount(); }""")
sub("""        jump(Math.floor(clamp((cx - r.left) / r.width, 0, 0.9999) * slides.length));""",
    """        jump(Math.floor(clamp((cx - r.left) / r.width, 0, 0.9999) * mainCount()));""")
sub("""      else if (e.key === 'End') { e.preventDefault(); jump(slides.length - 1); }""",
    """      else if (e.key === 'End') { e.preventDefault(); jump(mainCount() - 1); }""")
sub("""      else if (e.key === 'g') { e.preventDefault(); if (typed) jump(clamp(parseInt(typed, 10) - 1, 0, slides.length - 1)); }""",
    """      else if (e.key === 'g') { e.preventDefault(); if (typed) jump(clamp(parseInt(typed, 10) - 1, 0, mainCount() - 1)); }""")

# ---- external links: \href{url}{text} opens in a new tab; clicking it does not advance the slide ----
sub("""        var mg = /^\\\\goto\\{([^{}]*)\\}\\{/.exec(rest);""",
    """        var mh = /^\\\\href\\{([^{}]*)\\}\\{/.exec(rest);
        if (mh) {
          var oh = i + mh[0].length - 1, ch = matchBrace(s, oh);
          if (ch >= 0) {
            out += keep('<a class="lec-href" href="' + escAttr(mh[1].trim()) + '" target="_blank" rel="noopener">') +
              walk(s.slice(oh + 1, ch)) + keep('</a>');
            i = ch + 1;
            continue;
          }
        }
        var mg = /^\\\\goto\\{([^{}]*)\\}\\{/.exec(rest);""")
sub("""    '.lec-goto:hover{background:' + cssv('accent') + ';color:#fff}',""",
    """    '.lec-goto:hover{background:' + cssv('accent') + ';color:#fff}',
    '.lec-href{color:' + cssv('accent') + ';text-decoration:underline;text-underline-offset:.15em}',""")
sub("""    slideEl.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-goto]') : null;""",
    """    slideEl.addEventListener('click', function (e) {
      if (e.target && e.target.closest && e.target.closest('a[href]')) { e.stopPropagation(); return; }
      var a = e.target && e.target.closest ? e.target.closest('[data-goto]') : null;""")

open('talk-engine.js', 'w', encoding='utf-8').write(src)
print('talk-engine.js written', len(src))
