/* Lecture engine v2 — LaTeX-ish source -> slides, overlays, animated plots.
   Shared by the authoring deck (Lecture-v2.dc.html) and any published deck.
   Lecture source for this engine starts with \engine{2}. See README-v2.md. */
(function LECTURE_ENGINE() {
  'use strict';
  var VERSION = '2.0.0-dev';
  // A published file embeds this function's own text, so it never needs lecture-engine-v2.js.
  var ENGINE_SOURCE = '(' + LECTURE_ENGINE.toString() + ')();';

  var C = {
    teal: '#125A56', teal2: '#00767B', teal3: '#238F9D', blue: '#42A7C6', blue2: '#60BCE9',
    blue3: '#9DCCEF', pale: '#C6DBED', mist: '#DEE6E7', cream: '#ECEADA', sand: '#F0E6B2',
    gold: '#F9D576', amber: '#FFB954', orange: '#FD9A44', burnt: '#F57634',
    red: '#E94C1F', red2: '#D11807', maroon: '#A01813',
    // tracking colors for terms and factors: at least 4.5:1 on white, and still distinct
    // from one another under the common forms of color blindness
    c1: '#2A55B8', c2: '#B24A00', c3: '#8E3A8A', c4: '#00765A'
  };
  /* ---------- themes ----------
     A theme gives a color to each role below. The default theme is built in here and needs
     no other file. Other themes are written as blocks, in a lecture or in themes/*.js:
       \begin{theme}{name}
       base = default
       alert = #B00000
       \end{theme}
     and a lecture chooses one with \theme{name}. See README-v2.md, "Themes". */
  // [role, kind, group, default color]. kind decides the contrast check: text needs 3:1
  // against its background, a line (plot curve, bar) needs 3:1, edges and fills are not checked.
  var ROLE_LIST = [
    ['ink', 'text', 'Text', '#111111'], ['muted', 'text', 'Text', '#666666'], ['background', 'fill', 'Text', '#FFFFFF'],
    ['title', 'text', 'Text', '#111111'], ['heading', 'text', 'Text', '#125A56'], ['kicker', 'text', 'Text', '#238F9D'],
    ['alert', 'text', 'Text', '#D11807'], ['accent', 'text', 'Text', '#00767B'], ['bullet', 'line', 'Text', '#00767B'],
    ['divider.fill', 'fill', 'Text', '#DEE6E7'], ['table.head', 'text', 'Text', '#00767B'], ['table.rule', 'edge', 'Text', '#238F9D'],
    ['c1', 'text', 'Tracking', '#2A55B8'], ['c2', 'text', 'Tracking', '#B24A00'], ['c3', 'text', 'Tracking', '#8E3A8A'],
    ['c4', 'text', 'Tracking', '#00765A'],
    ['theorem.edge', 'edge', 'Boxes', '#125A56'], ['theorem.fill', 'fill', 'Boxes', '#DEE6E7'], ['theorem.label', 'text', 'Boxes', '#125A56'],
    ['definition.edge', 'edge', 'Boxes', '#238F9D'], ['definition.fill', 'fill', 'Boxes', '#DEE6E7'], ['definition.label', 'text', 'Boxes', '#00767B'],
    ['example.edge', 'edge', 'Boxes', '#F57634'], ['example.fill', 'fill', 'Boxes', '#ECEADA'], ['example.label', 'text', 'Boxes', '#A01813'],
    ['note.edge', 'edge', 'Boxes', '#00767B'], ['note.fill', 'fill', 'Boxes', '#DEE6E7'], ['note.label', 'text', 'Boxes', '#00767B'],
    ['proof.edge', 'edge', 'Boxes', '#555555'], ['proof.fill', 'fill', 'Boxes', '#FAFAFA'], ['proof.label', 'text', 'Boxes', '#555555'],
    ['question.edge', 'edge', 'Boxes', '#42A7C6'], ['question.fill', 'fill', 'Boxes', '#EAF4FB'], ['question.label', 'text', 'Boxes', '#125A56'],
    ['youtry.edge', 'edge', 'Boxes', '#42A7C6'], ['youtry.fill', 'fill', 'Boxes', '#EAF4FB'], ['youtry.label', 'text', 'Boxes', '#125A56'],
    ['box.edge', 'edge', 'Boxes', '#238F9D'],
    ['plot.curve', 'line', 'Plots', '#125A56'], ['plot.curve2', 'line', 'Plots', '#238F9D'], ['plot.secant', 'line', 'Plots', '#D11807'],
    ['plot.tangent', 'line', 'Plots', '#A01813'], ['plot.point', 'line', 'Plots', '#00767B'], ['plot.axis', 'line', 'Plots', '#222222'],
    ['plot.text', 'text', 'Plots', '#555555'], ['plot.grid', 'fill', 'Plots', '#DEE6E7'], ['plot.area', 'fill', 'Plots', '#C6DBED'],
    ['timer', 'text', 'Timer', '#00767B'], ['timer.warn', 'text', 'Timer', '#B24A00'], ['timer.end', 'text', 'Timer', '#D11807'],
    ['timer.track', 'fill', 'Timer', '#E8EFEF'],
    ['tray', 'text', 'Tray', '#125A56'], ['progress', 'line', 'Tray', '#238F9D']
  ];
  var ROLES = ROLE_LIST.map(function (r) { return { name: r[0], kind: r[1], group: r[2], color: r[3] }; });
  var DEFAULT_THEME = {};
  ROLES.forEach(function (r) { DEFAULT_THEME[r.name] = r.color; });
  var BOX_KINDS = ['theorem', 'definition', 'example', 'note', 'proof', 'question', 'youtry'];
  // Which background each text or line color sits on, for the contrast checks.
  function contrastPairs() {
    var out = [];
    ROLES.forEach(function (r) {
      if (r.kind !== 'text' && r.kind !== 'line') return;
      var m = r.name.match(/^(\w+)\.label$/);
      out.push([r.name, m ? m[1] + '.fill' : 'background']);
    });
    BOX_KINDS.forEach(function (k) { out.push(['ink', k + '.fill']); });
    out.push(['heading', 'divider.fill'], ['kicker', 'divider.fill']);
    return out;
  }
  function roleVar(role) { return '--lec-' + role.replace(/\./g, '-'); }
  // Custom properties for the roles that differ from the default theme.
  function themeStyle(colors) {
    if (!colors) return '';
    return ROLES.filter(function (r) { return colors[r.name] && colors[r.name].toUpperCase() !== r.color; })
      .map(function (r) { return roleVar(r.name) + ':' + colors[r.name]; }).join(';');
  }
  var CONTRAST_BLOCK = [
    '\\begin{theme}{contrast}', 'base = default',
    'ink = #000000', 'muted = #333333', 'title = #000000', 'heading = #003D3A', 'kicker = #005F66',
    'alert = #A00000', 'accent = #004F52', 'bullet = #004F52', 'divider.fill = #EEF2F2', 'table.head = #004F52', 'table.rule = #005F66',
    'c1 = #1E3F8A', 'c2 = #8A3900', 'c3 = #6E2A6B', 'c4 = #005944',
    'theorem.edge = #003D3A', 'theorem.fill = #EEF2F2', 'theorem.label = #003D3A',
    'definition.edge = #005F66', 'definition.fill = #EEF2F2', 'definition.label = #004F52',
    'example.edge = #A01813', 'example.fill = #F7F6EE', 'example.label = #7A0E0A',
    'note.edge = #004F52', 'note.fill = #EEF2F2', 'note.label = #004F52',
    'proof.edge = #222222', 'proof.label = #222222',
    'question.edge = #1F5F7A', 'question.fill = #F2F8FC', 'question.label = #003D3A',
    'youtry.edge = #1F5F7A', 'youtry.fill = #F2F8FC', 'youtry.label = #003D3A', 'box.edge = #005F66',
    'plot.curve = #003D3A', 'plot.curve2 = #005F66', 'plot.secant = #A00000', 'plot.tangent = #6E0A08',
    'plot.point = #004F52', 'plot.axis = #000000', 'plot.text = #333333',
    'timer = #004F52', 'timer.warn = #8A3900', 'timer.end = #A00000', 'tray = #003D3A', 'progress = #005F66',
    '\\end{theme}'
  ].join('\n');

  function colorValue(v) {
    v = String(v || '').trim();
    if (/^#([0-9a-f]{3})$/i.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
    if (C.hasOwnProperty(v)) return C[v].toUpperCase();
    return null;
  }
  // The lines of one \begin{theme}{name} ... \end{theme} block.
  function readThemeBody(name, lines) {
    var t = { name: name, base: 'default', colors: {}, problems: [] };
    lines.forEach(function (ln) {
      var s = ln.replace(/%.*$/, '').trim(), m;
      if (!s) return;
      if (!(m = s.match(/^([\w.]+)\s*=\s*(.*)$/))) { t.problems.push('theme ' + name + ': cannot read "' + s + '"'); return; }
      var key = m[1], val = m[2].trim();
      if (key === 'base') { t.base = val; return; }
      if (!DEFAULT_THEME.hasOwnProperty(key)) { t.problems.push('theme ' + name + ': unknown color name ' + key); return; }
      var hex = colorValue(val);
      if (!hex) { t.problems.push('theme ' + name + ': ' + key + ' = ' + val + ' is not a color; use #rrggbb or a palette name'); return; }
      t.colors[key] = hex;
    });
    return t;
  }
  // Theme blocks in a piece of source text (a lecture, or a theme file).
  function themeBlocks(text) {
    var out = {}, lines = String(text || '').replace(/\r/g, '').split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].trim().match(/^\\begin\{theme\}\{([^}]*)\}\s*$/);
      if (!m) continue;
      var body = [];
      for (i++; i < lines.length && !/^\\end\{theme\}/.test(lines[i].trim()); i++) body.push(lines[i]);
      out[m[1].trim()] = readThemeBody(m[1].trim(), body);
    }
    return out;
  }
  var BUILTIN_THEMES = { contrast: themeBlocks(CONTRAST_BLOCK).contrast };
  // Theme files register their block text: window.LECTURE_THEMES['name'] = '\begin{theme}{name}...'
  function fileThemes() {
    var reg = (typeof window !== 'undefined' && window.LECTURE_THEMES) || {}, out = {};
    Object.keys(reg).forEach(function (key) {
      var blocks = themeBlocks(reg[key]);
      if (blocks[key]) out[key] = blocks[key];
      else {
        var names = Object.keys(blocks);
        out[key] = names.length ? blocks[names[0]] : { name: key, base: 'default', colors: {}, problems: [] };
        out[key].problems = out[key].problems.concat(['theme file ' + key + ' does not contain \\begin{theme}{' + key + '}']);
      }
    });
    return out;
  }
  // Resolve a theme name to a full set of colors: a block in the lecture wins over a theme
  // file, which wins over the built-in themes. Every theme builds on its base.
  function resolveTheme(name, lectureThemes) {
    var files = fileThemes(), problems = [], chain = [];
    function find(n) {
      if (lectureThemes && lectureThemes[n]) return { t: lectureThemes[n], from: 'lecture' };
      if (files[n]) return { t: files[n], from: 'file' };
      if (BUILTIN_THEMES[n]) return { t: BUILTIN_THEMES[n], from: 'builtin' };
      return null;
    }
    function colorsOf(n, depth) {
      if (n === 'default') return Object.assign({}, DEFAULT_THEME);
      var f = find(n);
      if (!f) { problems.push('unknown theme ' + n + '; using default'); return Object.assign({}, DEFAULT_THEME); }
      if (depth > 8 || chain.indexOf(n) >= 0) { problems.push('theme ' + n + ' builds on itself'); return Object.assign({}, DEFAULT_THEME); }
      chain.push(n);
      f.t.problems.forEach(function (p) { if (problems.indexOf(p) < 0) problems.push(p); });
      var base = colorsOf(f.t.base || 'default', depth + 1);
      for (var k in f.t.colors) base[k] = f.t.colors[k];
      return base;
    }
    var colors = colorsOf(name || 'default', 0);
    var top = name && name !== 'default' ? find(name) : null;
    return { name: name || 'default', colors: colors, problems: problems, chain: chain, from: top ? top.from : 'builtin' };
  }
  function contrastRatio(a, b) {
    function lum(hex) {
      var ch = [1, 3, 5].map(function (i) {
        var c = parseInt(hex.substr(i, 2), 16) / 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    }
    var x = lum(colorValue(a) || '#000000'), y = lum(colorValue(b) || '#FFFFFF');
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function themeContrastProblems(colors) {
    var out = [];
    contrastPairs().forEach(function (p) {
      var r = contrastRatio(colors[p[0]], colors[p[1]]);
      if (r < 3) out.push(p[0] + ' on ' + p[1] + ' is ' + (r < 2.95 ? r.toFixed(1) : r.toFixed(2)) + ':1, below 3:1');
    });
    return out;
  }
  // Colors handed to js figures: the fixed palette plus the theme's roles by short name.
  function figureColors(colors) {
    var t = colors || DEFAULT_THEME, out = {};
    for (var k in C) out[k] = C[k];
    ['ink', 'muted', 'background', 'title', 'heading', 'alert', 'accent', 'bullet', 'c1', 'c2', 'c3', 'c4']
      .forEach(function (k) { out[k] = t[k]; });
    ['curve', 'curve2', 'secant', 'tangent', 'point', 'axis', 'text', 'grid', 'area'].forEach(function (k) { out[k] = t['plot.' + k]; });
    return out;
  }
  function blockText(name, base, colors) {
    var baseColors = resolveTheme(base).colors, lines = ['\\begin{theme}{' + name + '}', 'base = ' + base];
    ROLES.forEach(function (r) {
      var v = colorValue(colors[r.name]);
      if (v && v !== baseColors[r.name]) lines.push(r.name + ' = ' + v);
    });
    lines.push('\\end{theme}');
    return lines.join('\n');
  }

  // One stylesheet for slides and the player. Colors come from the theme roles above, as
  // custom properties; every type size is computed from --k, the slide's type scale, with a
  // 19px floor (14pt on the 1920x1080 stage).
  function fsz(n) { return 'font-size:max(19px,calc(' + n + 'px*var(--k,1)))'; }
  function cssv(role) { return 'var(' + roleVar(role) + ')'; }
  var ENGINE_CSS = [
    ':root{' + ROLES.map(function (r) { return roleVar(r.name) + ':' + r.color; }).join(';') + ';',
    "--lec-pale:#C6DBED;--lec-ft:'Spectral','Iowan Old Style',Georgia,serif;--lec-fm:'JetBrains Mono',ui-monospace,'SFMono-Regular',Menlo,monospace}",
    // KaTeX's own defaults are .katex{font-size:1.21em} and .katex-display{margin:1em 0}
    '.katex{font-size:1.04em}.katex-display{margin:0.35em 0 !important}',
    '.lec-slide{height:100%;box-sizing:border-box;background:' + cssv('background') + ';color:' + cssv('ink') + ';font-family:var(--lec-ft);' + fsz(36) + '}',
    '.lec-slide--body{padding:30px 120px 132px;display:flex;flex-direction:column}',
    '.lec-slide--title,.lec-slide--divider{padding:96px 120px 132px;display:flex;flex-direction:column;justify-content:center}',
    '.lec-slide--title{gap:8px}.lec-slide--divider{background:' + cssv('divider.fill') + '}',
    '.lec-kicker{font-family:var(--lec-fm);' + fsz(24) + ';letter-spacing:.2em;text-transform:uppercase;color:' + cssv('kicker') + '}',
    '.lec-title{' + fsz(104) + ';line-height:1.05;font-weight:600;margin:14px 0 0;color:' + cssv('title') + ';max-width:1400px}',
    '.lec-title-gap{height:44px}',
    '.lec-author{' + fsz(40) + ';color:' + cssv('ink') + '}',
    '.lec-date{font-family:var(--lec-fm);' + fsz(24) + ';color:' + cssv('muted') + ';margin-top:6px}',
    '.lec-divider-title{' + fsz(86) + ';line-height:1.1;font-weight:600;margin:16px 0 0;color:' + cssv('heading') + ';max-width:1400px}',
    '.lec-h{' + fsz(58) + ';line-height:1.15;font-weight:600;margin:0 0 24px;color:' + cssv('title') + '}',
    '.lec-flow{flex:1 1 auto;min-height:0;transform-origin:top left;display:flex;flex-direction:column}',
    '.lec-body{flex:0 0 auto}.lec-body--center{margin-top:auto;margin-bottom:auto}.lec-body--bottom{margin-top:auto}',
    '.lec-body--fill{flex:1 1 auto;display:flex;flex-direction:column}',
    '.lec-body--align-center{text-align:center}.lec-body--align-right{text-align:right}',
    '.lec-p{margin:0 0 18px;' + fsz(36) + ';line-height:1.5;text-wrap:pretty}',
    '.lec-list{margin:0 0 18px;padding:0;list-style:none;display:flex;flex-direction:column;gap:16px}',
    '.lec-list--tight{gap:8px}',
    '.lec-li{display:flex;gap:18px;align-items:flex-start;text-align:left}.lec-li--sub{margin-left:52px}',
    '.lec-item{' + fsz(36) + ';line-height:1.5;text-wrap:pretty}',
    '.lec-dot{' + fsz(36) + ';width:12px;height:12px;border-radius:50%;background:' + cssv('bullet') + ';flex:0 0 auto;margin-top:.44em}',
    '.lec-dot--sub{opacity:.55}',
    '.lec-mark{font-family:var(--lec-fm);' + fsz(24) + ';color:' + cssv('bullet') + ';flex:0 0 auto;padding-top:8px}',
    '.lec-mark--num{' + fsz(26) + ';min-width:38px}.lec-mark--none{width:12px;flex:0 0 auto}',
    '.lec-math{margin:6px 0 20px;display:flex;flex-direction:column;gap:10px;align-items:flex-start}',
    '.lec-body--align-center .lec-math{align-items:center}.lec-body--align-right .lec-math{align-items:flex-end}',
    '.lec-math-line,.lec-display{' + fsz(42) + '}.lec-display{display:block;margin:.4em 0}',
    '.lec-box{margin:8px 0 22px;padding:22px 28px;background:var(--box-bg);border-left:6px solid var(--box-edge)}',
    BOX_KINDS.map(function (k) {
      return '.lec-box--' + k + '{--box-edge:' + cssv(k + '.edge') + ';--box-bg:' + cssv(k + '.fill') + ';--box-label:' + cssv(k + '.label') + '}';
    }).join(''),
    '.lec-box-label{font-family:var(--lec-fm);' + fsz(22) + ';letter-spacing:.14em;text-transform:uppercase;color:var(--box-label);margin-bottom:12px}',
    '.lec-box-name{text-transform:none;letter-spacing:.02em}',
    '.lec-panel{margin:8px 0 22px;padding:22px 28px;background:' + cssv('background') + ';border:2px solid ' + cssv('box.edge') + ';border-radius:8px}',
    '.lec-cols{display:grid;align-items:start}.lec-col{min-width:0}',
    '.lec-table{border-collapse:collapse;margin:8px 0 22px;' + fsz(32) + '}',
    '.lec-table th,.lec-table td{padding:12px 28px 12px 0;text-align:left}',
    '.lec-table th{font-family:var(--lec-fm);' + fsz(22) + ';letter-spacing:.12em;text-transform:uppercase;color:' + cssv('table.head') + ';border-bottom:2px solid ' + cssv('table.rule') + '}',
    '.lec-table td{border-bottom:1px solid ' + cssv('divider.fill') + '}',
    '.lec-figure{margin:6px 0 16px}.lec-canvas{display:block;max-width:100%}',
    '.lec-plot-wrap{position:relative;max-width:100%}.lec-plot-wrap .lec-canvas{width:100%;height:auto}',
    '.lec-plot-labels{position:absolute;inset:0;pointer-events:none}',
    '.lec-plot-label{position:absolute;white-space:nowrap;' + fsz(30) + ';padding:0 6px;border-radius:4px;',
    'background:color-mix(in srgb,' + cssv('background') + ' 82%,transparent)}',
    '.lec-caption{font-family:var(--lec-fm);' + fsz(20) + ';color:' + cssv('muted') + ';margin-top:8px}',
    '.lec-imageslot{margin:8px 0 20px}',
    '.lec-drop{position:relative;min-height:360px;display:flex;align-items:center;justify-content:center;border:2px dashed var(--lec-pale);',
    'background:repeating-linear-gradient(45deg,#fcfcfb 0 10px,#f6f7f6 10px 20px);overflow:hidden}',
    '.lec-drop-hint{font-family:var(--lec-fm);' + fsz(20) + ';color:' + cssv('accent') + ';text-align:center;padding:20px}',
    '.lec-alert{color:' + cssv('alert') + '}.lec-accent{color:' + cssv('accent') + '}.lec-b{font-weight:600}.lec-em{font-style:italic}',
    '.lec-tt{font-family:var(--lec-fm);font-size:.9em}',
    '.lec-c1{color:' + cssv('c1') + '}.lec-c2{color:' + cssv('c2') + '}.lec-c3{color:' + cssv('c3') + '}.lec-c4{color:' + cssv('c4') + '}',
    Object.keys(C).filter(function (k) { return !/^c\d$/.test(k); }).map(function (k) { return '.lec-col-' + k + '{color:' + C[k] + '}'; }).join(''),
    '.lec-size-small{font-size:max(19px,.8em)}.lec-size-large{font-size:1.2em}.lec-size-Large{font-size:1.44em}.lec-size-huge{font-size:1.73em}',
    '.lec-gap{display:block}',
    '.lec-heading{' + fsz(42) + ';line-height:1.2;font-weight:600;color:' + cssv('heading') + ';margin:10px 0 14px}',
    '.lec-align--center{text-align:center}.lec-align--flushright{text-align:right}.lec-align--flushleft{text-align:left}',
    '.lec-align--center .lec-math{align-items:center}.lec-align--flushright .lec-math{align-items:flex-end}',
    // timer: big digits and a bar; click or t pauses and resumes
    '.lec-timer-wrap{display:flex;justify-content:center;margin:10px 0 18px}',
    '.lec-timer{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(960px,100%);padding:6px 0 10px;',
    'border:0;background:none;cursor:pointer;font-family:var(--lec-fm);color:' + cssv('timer') + '}',
    '.lec-timer:focus-visible{outline:3px solid ' + cssv('accent') + ';outline-offset:4px}',
    '.lec-timer-digits{' + fsz(70) + ';font-weight:600;line-height:1;font-variant-numeric:tabular-nums}',
    '.lec-timer-track{display:block;width:100%;height:16px;background:' + cssv('timer.track') + '}',
    '.lec-timer-fill{display:block;height:100%;width:100%;background:currentColor}',
    '.lec-timer--warn{color:' + cssv('timer.warn') + '}.lec-timer--end{color:' + cssv('timer.end') + '}',
    '.lec-timer--paused .lec-timer-digits{opacity:.55}',
    '[data-from]{transition:opacity .3s ease}',
    '.lec-cue{position:absolute;right:28px;top:50%;transform:translateY(-50%);z-index:30;pointer-events:none;user-select:none;',
    'font-family:var(--lec-fm);font-size:52px;line-height:1;color:#6f7c7d;opacity:0;transition:opacity .16s ease}',
    // the player: the slide, its tray, and the progress bar
    '.lec-player{position:absolute;inset:0;z-index:0;overflow:hidden;background:' + cssv('background') + '}',
    '.lec-stage-slide{position:absolute;inset:0}',
    '.lec-tray{position:absolute;left:0;right:0;bottom:0;height:96px;display:flex;align-items:center;gap:26px;padding:0 48px;',
    'box-sizing:border-box;font-family:var(--lec-fm);font-size:22px;color:' + cssv('muted') + ';',
    'background:linear-gradient(to top,' + cssv('background') + ' 40%,transparent);user-select:none;z-index:5}',
    '.lec-nav{width:62px;height:62px;flex:0 0 auto;padding:0;border-radius:50%;border:1px solid var(--lec-pale);',
    'background:color-mix(in srgb,' + cssv('background') + ' 50%,transparent);color:' + cssv('tray') + ';display:flex;align-items:center;justify-content:center;',
    'font-family:inherit;font-size:30px;cursor:pointer;transition:background .18s ease,opacity .18s ease}',
    '.lec-nav:hover,.lec-nav:focus-visible{background:' + cssv('divider.fill') + ';opacity:1 !important}',
    '.lec-player button:focus-visible{outline:3px solid ' + cssv('accent') + ';outline-offset:2px}',
    '.lec-footer{flex:1 1 auto;min-width:0;font-size:24px;color:' + cssv('tray') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lec-footer .katex{font-size:1em}',
    '.lec-copy{color:' + cssv('muted') + ';white-space:nowrap}.lec-counter{color:' + cssv('ink') + ';white-space:nowrap;text-align:right}',
    '.lec-extra{flex:0 0 auto;height:46px;padding:0 18px;border-radius:23px;border:1px solid var(--lec-pale);',
    'background:color-mix(in srgb,' + cssv('background') + ' 50%,transparent);color:' + cssv('accent') + ';display:flex;align-items:center;gap:10px;font-family:inherit;',
    'font-size:20px;cursor:pointer;transition:background .18s ease}.lec-extra:hover{background:' + cssv('divider.fill') + '}',
    '.lec-bar{position:absolute;left:0;bottom:0;height:5px;width:0;background:' + cssv('progress') + ';transition:width .32s ease;z-index:6}',
    '.lec-track{position:absolute;left:0;right:0;bottom:0;height:18px;cursor:ew-resize;z-index:7;touch-action:none}',
    '.lec-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '@media (prefers-reduced-motion: reduce){.lec-player *,.lec-slide *{transition:none !important}}'
  ].join('');
  function ensureEngineCSS() {
    if (typeof document === 'undefined' || !document.createElement || document.getElementById('lec-engine-css')) return;
    var st = document.createElement('style');
    st.id = 'lec-engine-css';
    st.textContent = ENGINE_CSS;
    (document.head || document.documentElement).appendChild(st);
  }
  var FT = "'Spectral', 'Iowan Old Style', Georgia, serif";
  var FM = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

  /* ---------- small utils ---------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : d; }
  function bool(v, d) {
    if (v === undefined || v === null || v === '') return d;
    v = String(v).trim().toLowerCase();
    return v === 'true' || v === 'yes' || v === '1' || v === 'on';
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- expression compiler (v2) ----------
     Formula text -> tokens -> syntax tree -> function of one variable.
     The conventions are documented in README-v2.md under "Formulas". */
  var VARS = { x: 1, t: 1, n: 1 };
  var CONSTS = { e: Math.E, pi: Math.PI };
  var TRIG_INV = { sin: 'asin', cos: 'acos', tan: 'atan', sec: 'asec', csc: 'acsc', cot: 'acot' };
  var FN = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    sec: function (v) { return 1 / Math.cos(v); },
    csc: function (v) { return 1 / Math.sin(v); },
    cot: function (v) { return 1 / Math.tan(v); },
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    asec: function (v) { return Math.acos(1 / v); },
    acsc: function (v) { return Math.asin(1 / v); },
    acot: function (v) { return v === 0 ? Math.PI / 2 : Math.atan(1 / v) + (v < 0 ? Math.PI : 0); },
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    exp: Math.exp, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
    min: Math.min, max: Math.max
  };
  var FN_ALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', arcsec: 'asec', arccsc: 'acsc', arccot: 'acot', sgn: 'sign' };
  var FN_ARGS = { min: 2, max: 2 }; // everything else takes one argument
  // Names are matched longest-first, so "exp" wins over "e" and "sinh" over "sin".
  var NAMES = Object.keys(FN).concat(Object.keys(FN_ALIAS), Object.keys(CONSTS), Object.keys(VARS))
    .sort(function (a, b) { return b.length - a.length; });
  var TEX_SKIP = { left: 1, right: 1, big: 1, Big: 1, bigg: 1, Bigg: 1, mathrm: 1, text: 1, displaystyle: 1, quad: 1, qquad: 1 };
  var TEX_OPS = { cdot: '*', times: '*', div: '/', lvert: '|', rvert: '|', vert: '|' };

  function FormulaError(message, pos) { this.message = message; this.pos = pos; }
  function at(pos) { return ' at character ' + (pos + 1); }

  function tokenize(src) {
    var toks = [], i = 0, m;
    while (i < src.length) {
      var c = src[i], rest = src.slice(i);
      if (/\s/.test(c)) { i++; continue; }
      if ((m = /^(\d+\.?\d*|\.\d+)/.exec(rest))) { toks.push({ k: 'num', v: m[1], pos: i }); i += m[1].length; continue; }
      if (c === '\\') {
        if ((m = /^\\([a-zA-Z]+)/.exec(rest))) {
          var w = m[1];
          if (TEX_SKIP[w]) { i += m[0].length; continue; }
          if (TEX_OPS[w]) { toks.push({ k: 'op', v: TEX_OPS[w], pos: i }); i += m[0].length; continue; }
          if (w === 'frac' || w === 'dfrac' || w === 'tfrac') { toks.push({ k: 'frac', v: w, pos: i }); i += m[0].length; continue; }
          if (w === 'sqrt') { toks.push({ k: 'sqrt', v: w, pos: i }); i += m[0].length; continue; }
          if (FN[w] || FN_ALIAS[w]) { toks.push({ k: 'fn', v: FN_ALIAS[w] || w, pos: i }); i += m[0].length; continue; }
          if (CONSTS[w]) { toks.push({ k: 'const', v: w, pos: i }); i += m[0].length; continue; }
          throw new FormulaError('unknown command \\' + w + at(i), i);
        }
        if (/^\\[,;:! ]/.test(rest)) { i += 2; continue; } // thin spaces
        if (rest.charAt(1) === '{' || rest.charAt(1) === '}') throw new FormulaError('write ( ) for grouping instead of \\' + rest.charAt(1) + at(i), i);
        throw new FormulaError('stray backslash' + at(i), i);
      }
      if (/[a-zA-Z]/.test(c)) {
        var hit = null;
        for (var k = 0; k < NAMES.length; k++) if (rest.indexOf(NAMES[k]) === 0) { hit = NAMES[k]; break; }
        if (!hit) throw new FormulaError('unknown name \'' + c + '\'' + at(i) + ' (the variable is x)', i);
        if (VARS[hit]) toks.push({ k: 'var', v: hit, pos: i });
        else if (CONSTS[hit]) toks.push({ k: 'const', v: hit, pos: i });
        else toks.push({ k: 'fn', v: FN_ALIAS[hit] || hit, pos: i });
        i += hit.length; continue;
      }
      if (c === '\u03c0') { toks.push({ k: 'const', v: 'pi', pos: i }); i++; continue; }
      if (c === '\u2212') { toks.push({ k: 'op', v: '-', pos: i }); i++; continue; }
      if (c === '\u00b7' || c === '\u00d7') { toks.push({ k: 'op', v: '*', pos: i }); i++; continue; }
      if (c === '\u00f7') { toks.push({ k: 'op', v: '/', pos: i }); i++; continue; }
      if ('+-*/^_,|()[]{}'.indexOf(c) >= 0) { toks.push({ k: 'op', v: c, pos: i }); i++; continue; }
      throw new FormulaError('unexpected \'' + c + '\'' + at(i), i);
    }
    toks.push({ k: 'end', v: '', pos: src.length });
    return toks;
  }

  // Syntax tree nodes: {t:'num',v} {t:'var'} {t:'neg',a} {t:'add'|'sub'|'mul'|'div',a,b}
  // {t:'pow',a,b} {t:'root',a,q} {t:'call',f,args} {t:'abs',a}
  function parseFormula(src) {
    var toks = tokenize(src), p = 0, absDepth = 0, warnings = [];
    var used = {};
    toks.forEach(function (tk) { if (tk.k === 'var') used[tk.v] = 1; });
    if (Object.keys(used).length > 1) warnings.push('x, t and n all stand for the same variable here');
    function peek() { return toks[p]; }
    function next() { return toks[p++]; }
    function isOp(tok, v) { return tok.k === 'op' && tok.v === v; }
    function expect(v, openTok) {
      var tok = peek();
      if (isOp(tok, v)) return next();
      if (openTok) throw new FormulaError('missing \'' + v + '\' to match \'' + openTok.v + '\'' + at(openTok.pos), tok.pos);
      throw new FormulaError('expected \'' + v + '\'' + at(tok.pos), tok.pos);
    }
    var CLOSE = { '(': ')', '{': '}', '[': ']' };

    function startsFactor(tok, allowFn) {
      if (tok.k === 'num' || tok.k === 'var' || tok.k === 'const' || tok.k === 'frac' || tok.k === 'sqrt') return true;
      if (tok.k === 'fn') return allowFn;
      if (tok.k === 'op') return tok.v === '(' || tok.v === '{' || (tok.v === '|' && absDepth === 0);
      return false;
    }
    function parseSum() {
      var left = parseProduct();
      for (;;) {
        var tok = peek();
        if (isOp(tok, '+') || isOp(tok, '-')) { next(); left = { t: tok.v === '+' ? 'add' : 'sub', a: left, b: parseProduct() }; }
        else return left;
      }
    }
    function parseProduct() {
      var left = parseImplicit(true).node;
      for (;;) {
        var tok = peek();
        if (isOp(tok, '*')) { next(); left = { t: 'mul', a: left, b: parseImplicit(true).node }; continue; }
        if (isOp(tok, '/')) {
          next();
          var r = parseImplicit(true);
          if (r.count > 1) {
            var d = src.slice(r.start, r.end).trim();
            warnings.push('read "/' + d + '" as "/(' + d + ')"' + at(tok.pos) + '; add parentheses to make it explicit');
          }
          left = { t: 'div', a: left, b: r.node };
          continue;
        }
        return left;
      }
    }
    // A run of juxtaposed factors: 2x, xe^x, 2sin x cos x. Binds tighter than * and /,
    // so 1/2x is 1/(2x). allowFn=false inside a bare function argument, so that
    // sin x cos x is sin(x)cos(x) rather than sin(x cos x).
    function parseImplicit(allowFn) {
      var start = peek().pos;
      var node = parseUnary(allowFn), count = 1;
      while (startsFactor(peek(), allowFn)) { node = { t: 'mul', a: node, b: parsePower(allowFn) }; count++; }
      return { node: node, count: count, start: start, end: peek().pos };
    }
    function parseUnary(allowFn) {
      var tok = peek();
      if (isOp(tok, '-')) { next(); return { t: 'neg', a: parseUnary(allowFn) }; }
      if (isOp(tok, '+')) { next(); return parseUnary(allowFn); }
      return parsePower(allowFn);
    }
    function parsePower(allowFn) {
      var base = parsePrimary(allowFn);
      if (isOp(peek(), '^')) { next(); return { t: 'pow', a: base, b: parseExponent() }; }
      return base;
    }
    // Right-associative, and a sign is allowed: x^2^3 = x^(2^3), 2^-x = 2^(-x).
    // e^2x is e^2 times x, matching how it typesets.
    function parseExponent() {
      var tok = peek();
      if (isOp(tok, '-')) { next(); return { t: 'neg', a: parseExponent() }; }
      if (isOp(tok, '+')) { next(); return parseExponent(); }
      return parsePower(true);
    }
    function group(openTok) {
      next();
      if (openTok.v === '|') {
        absDepth++;
        var inner = parseSum();
        absDepth--;
        expect('|', openTok);
        return { t: 'abs', a: inner };
      }
      var e = parseSum();
      expect(CLOSE[openTok.v], openTok);
      return e;
    }
    // Argument of \frac or \sqrt: a {group}, or a single character as in \frac12.
    function texArg(cmdTok) {
      var tok = peek();
      if (isOp(tok, '{')) return group(tok);
      if (tok.k === 'num') {
        if (tok.v.length > 1) { toks.splice(p + 1, 0, { k: 'num', v: tok.v.slice(1), pos: tok.pos + 1 }); tok.v = tok.v.charAt(0); }
        next(); return { t: 'num', v: +tok.v };
      }
      if (tok.k === 'var' || tok.k === 'const') return parsePrimary(true);
      throw new FormulaError('\\' + cmdTok.v + ' needs an argument in { }' + at(tok.pos), tok.pos);
    }
    function parsePrimary(allowFn) {
      var tok = peek();
      if (tok.k === 'num') { next(); return { t: 'num', v: +tok.v }; }
      if (tok.k === 'var') { next(); return { t: 'var' }; }
      if (tok.k === 'const') { next(); return { t: 'num', v: CONSTS[tok.v] }; }
      if (tok.k === 'op' && (tok.v === '(' || tok.v === '{' || tok.v === '|')) return group(tok);
      if (tok.k === 'frac') { next(); var a = texArg(tok); var b = texArg(tok); return { t: 'div', a: a, b: b }; }
      if (tok.k === 'sqrt') {
        next();
        var q = null;
        if (isOp(peek(), '[')) { var ob = next(); q = parseSum(); expect(']', ob); }
        var arg = texArg(tok);
        if (!q) return { t: 'call', f: 'sqrt', args: [arg] };
        return { t: 'root', a: arg, q: q };
      }
      if (tok.k === 'fn') return parseCall(allowFn);
      if (tok.k === 'end') throw new FormulaError(p === 0 ? 'empty formula' : 'formula ends too early' + at(tok.pos), tok.pos);
      if (isOp(tok, ')') || isOp(tok, '}') || isOp(tok, ']')) throw new FormulaError('unmatched \'' + tok.v + '\'' + at(tok.pos), tok.pos);
      throw new FormulaError('unexpected \'' + tok.v + '\'' + at(tok.pos), tok.pos);
    }
    function parseCall() {
      var fTok = next(), name = fTok.v, base = null, power = null;
      if (name === 'log' && isOp(peek(), '_')) {
        next();
        var bt = peek();
        if (isOp(bt, '{') || isOp(bt, '(')) base = group(bt);
        else if (bt.k === 'num' || bt.k === 'const') base = parsePrimary(true);
        else throw new FormulaError('log_ needs a base' + at(bt.pos), bt.pos);
      } else if (name === 'log') {
        warnings.push('read log' + at(fTok.pos) + ' as base 10; write ln for the natural logarithm');
      }
      if (isOp(peek(), '^')) { next(); power = parseExponent(); }
      if (power && TRIG_INV[name] && power.t === 'neg' && power.a.t === 'num' && power.a.v === 1) {
        name = TRIG_INV[name]; power = null; // sin^{-1} x is arcsin x
      }
      var nargs = FN_ARGS[name] || 1, args = [], tok = peek();
      if (isOp(tok, '(') || isOp(tok, '{')) {
        var open = next();
        args.push(parseSum());
        while (isOp(peek(), ',')) { next(); args.push(parseSum()); }
        expect(CLOSE[open.v], open);
      } else {
        // bare argument: an optional sign, then juxtaposed factors up to the next function name
        if (!startsFactor(tok, true) && !isOp(tok, '-') && !isOp(tok, '+')) {
          throw new FormulaError('\'' + fTok.v + '\' needs an argument' + at(tok.pos), tok.pos);
        }
        args.push(parseImplicit(false).node);
      }
      if (args.length !== nargs) {
        throw new FormulaError('\'' + fTok.v + '\' takes ' + nargs + ' argument' + (nargs > 1 ? 's' : '') + at(fTok.pos), fTok.pos);
      }
      var node = { t: 'call', f: name, args: args };
      if (base) node = { t: 'div', a: { t: 'call', f: 'ln', args: args }, b: { t: 'call', f: 'ln', args: [base] } };
      // sin(x)^2 and sin^2 x both mean (sin x)^2
      if (isOp(peek(), '^') && !power) { next(); power = parseExponent(); }
      return power ? { t: 'pow', a: node, b: power } : node;
    }

    var tree = parseSum();
    var tail = peek();
    if (tail.k !== 'end') {
      if (isOp(tail, ')') || isOp(tail, '}') || isOp(tail, ']')) throw new FormulaError('unmatched \'' + tail.v + '\'' + at(tail.pos), tail.pos);
      if (isOp(tail, '|')) throw new FormulaError('unmatched \'|\'' + at(tail.pos) + '; nested bars need abs( )', tail.pos);
      throw new FormulaError('unexpected \'' + tail.v + '\'' + at(tail.pos), tail.pos);
    }
    return { tree: tree, warnings: warnings };
  }

  // An exponent written as a literal fraction p/q (or an integer) is kept exact,
  // so that x^(2/3) has real values for x < 0.
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var r = a % b; a = b; b = r; } return a; }
  function isInt(node) { return node.t === 'num' && Number.isInteger(node.v); }
  function rational(node) {
    if (node.t === 'neg') { var r = rational(node.a); return r && { p: -r.p, q: r.q }; }
    if (isInt(node)) return { p: node.v, q: 1 };
    if (node.t === 'div') {
      var ra = rational(node.a), rb = rational(node.b);
      if (!ra || !rb || rb.p === 0) return null;
      var pp = ra.p * rb.q, q = ra.q * rb.p, g = gcd(pp, q) || 1;
      pp /= g; q /= g;
      return q < 0 ? { p: -pp, q: -q } : { p: pp, q: q };
    }
    return null;
  }
  function realRoot(v, p, q) { // v^(p/q) with q odd, reduced
    if (v >= 0) return Math.pow(v, p / q);
    var mag = Math.pow(-v, p / q);
    return p % 2 === 0 ? mag : -mag;
  }

  function build(node) {
    switch (node.t) {
      case 'num': var c = node.v; return function () { return c; };
      case 'var': return function (x) { return x; };
      case 'neg': var a0 = build(node.a); return function (x) { return -a0(x); };
      case 'add': var a1 = build(node.a), b1 = build(node.b); return function (x) { return a1(x) + b1(x); };
      case 'sub': var a2 = build(node.a), b2 = build(node.b); return function (x) { return a2(x) - b2(x); };
      case 'mul': var a3 = build(node.a), b3 = build(node.b); return function (x) { return a3(x) * b3(x); };
      case 'div': var a4 = build(node.a), b4 = build(node.b); return function (x) { return a4(x) / b4(x); };
      case 'abs': var a5 = build(node.a); return function (x) { return Math.abs(a5(x)); };
      case 'pow':
        var base = build(node.a), r = rational(node.b);
        if (r && r.q > 1 && r.q % 2 === 1) { var rp = r.p, rq = r.q; return function (x) { return realRoot(base(x), rp, rq); }; }
        var ex = build(node.b);
        return function (x) { return Math.pow(base(x), ex(x)); };
      case 'root':
        var ra = build(node.a), qn = rational(node.q);
        if (qn && qn.q === 1 && qn.p > 0 && qn.p % 2 === 1) { var n1 = qn.p; return function (x) { return realRoot(ra(x), 1, n1); }; }
        var qf = build(node.q);
        return function (x) { return Math.pow(ra(x), 1 / qf(x)); };
      case 'call':
        var f = FN[node.f], args = node.args.map(build);
        if (args.length === 1) { var g0 = args[0]; return function (x) { return f(g0(x)); }; }
        return function (x) { return f.apply(null, args.map(function (g) { return g(x); })); };
    }
    throw new Error('unknown node ' + node.t);
  }

  var compileCache = {};
  function compileExpr(expr) {
    var src = String(expr == null ? '' : expr);
    if (compileCache.hasOwnProperty(src)) return compileCache[src];
    var out;
    try {
      var parsed = parseFormula(src);
      out = { fn: build(parsed.tree), error: null, warnings: parsed.warnings };
    } catch (err) {
      if (!(err instanceof FormulaError)) throw err;
      out = { fn: function () { return NaN; }, error: { message: err.message, pos: err.pos }, warnings: [] };
    }
    compileCache[src] = out;
    return out;
  }
  // The function form used by plots and by plot.compile in js blocks. A formula that
  // cannot be read returns NaN everywhere and carries .error = { message, pos }.
  function compile(expr) {
    var c = compileExpr(expr), fn = function (x) { return c.fn(x); };
    fn.error = c.error; fn.warnings = c.warnings;
    return fn;
  }
  // Numeric settings such as domain = -pi:2pi accept constant formulas.
  function numExpr(v, d) {
    var s = String(v == null ? '' : v).trim();
    if (s === '') return d;
    var n = Number(s);
    if (isFinite(n)) return n;
    var c = compileExpr(s);
    if (c.error) return d;
    var val = c.fn(0);
    return isFinite(val) ? val : d;
  }

  /* ---------- KaTeX ---------- */
  function tex(s, display) {
    if (!window.katex) return '<code style="font-family:' + FM + '">' + esc(s) + '</code>';
    try {
      // \alert and \accent become classes, so math follows the theme's colors
      var src = String(s).replace(/\\alert\{/g, '\\htmlClass{lec-alert}{').replace(/\\accent\{/g, '\\htmlClass{lec-accent}{')
        .replace(/\\textcolor\{\s*([a-z]\w*)\s*\}\{/g, function (m, name) {
          var cls = colorClass(name);
          return cls ? '\\htmlClass{' + cls + '}{' : m;
        });
      return window.katex.renderToString(src, {
        displayMode: !!display, throwOnError: false, strict: false,
        trust: function (ctx) { return ctx.command === '\\htmlClass'; },
        macros: { '\\R': '\\mathbb{R}', '\\dd': '\\mathrm{d}', '\\eps': '\\varepsilon' }
      });
    } catch (err) {
      return '<span style="color:' + C.red2 + ';font-family:' + FM + '">' + esc(s) + '</span>';
    }
  }

  // Named colors: c1 to c4 follow the theme; the palette names are fixed.
  function colorClass(name) {
    if (/^c[1-4]$/.test(name)) return 'lec-' + name;
    if (name === 'alert' || name === 'accent') return 'lec-' + name;
    if (C.hasOwnProperty(name)) return 'lec-col-' + name;
    return null;
  }
  function hexColor(v) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : null; }
  function contrastOnWhite(hex) {
    var h = hex.length === 4 ? '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3] : hex;
    var ch = [1, 3, 5].map(function (i) {
      var c = parseInt(h.substr(i, 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    return 1.05 / (lum + 0.05);
  }

  /* ---------- overlay ranges ---------- */
  function range(spec) {
    if (!spec) return { from: 0, to: Infinity };
    spec = spec.trim();
    var m;
    if ((m = spec.match(/^(\d+)\s*-\s*(\d+)$/))) return { from: +m[1], to: +m[2] };
    if ((m = spec.match(/^(\d+)\s*-$/))) return { from: +m[1], to: Infinity };
    if ((m = spec.match(/^-\s*(\d+)$/))) return { from: 0, to: +m[1] };
    if ((m = spec.match(/^(\d+)$/))) return { from: +m[1], to: +m[1] };
    return { from: 0, to: Infinity };
  }
  function matchBrace(s, i) { // i points at '{'
    var d = 0;
    for (var k = i; k < s.length; k++) {
      if (s[k] === '{' && s[k - 1] !== '\\') d++;
      else if (s[k] === '}' && s[k - 1] !== '\\') { d--; if (!d) return k; }
    }
    return -1;
  }

  /* ---------- inline text ---------- */
  function inline(src) {
    var stash = [];
    function keep(html) { stash.push(html); return '\u0001' + (stash.length - 1) + '\u0001'; }

    function walk(s) {
      var out = '', i = 0;
      while (i < s.length) {
        var rest = s.slice(i);
        var m = /^\\textcolor\{\s*([^{}]*?)\s*\}\{/.exec(rest);
        if (m) {
          var open0 = i + m[0].length - 1, close0 = matchBrace(s, open0);
          if (close0 >= 0) {
            var cls = colorClass(m[1]), hx = hexColor(m[1]);
            var tag0 = cls ? '<span class="' + cls + '">' : hx ? '<span style="color:' + hx + '">' : '<span>';
            out += keep(tag0) + walk(s.slice(open0 + 1, close0)) + keep('</span>');
            i = close0 + 1;
            continue;
          }
        }
        m = /^\\(only|uncover|visible|alert|textbf|emph|textit|texttt|accent|small|large|Large|huge)(?:<([^>]*)>)?\{/.exec(rest);
        if (m) {
          var open = i + m[0].length - 1;
          var close = matchBrace(s, open);
          if (close < 0) { out += s[i++]; continue; }
          var body = walk(s.slice(open + 1, close));
          var cmd = m[1], r = range(m[2]);
          var tag;
          if (cmd === 'only') tag = keep('<span data-from="' + r.from + '" data-to="' + r.to + '" data-hide="none">');
          else if (cmd === 'uncover' || cmd === 'visible') tag = keep('<span data-from="' + r.from + '" data-to="' + r.to + '">');
          else if (cmd === 'alert') tag = keep('<span class="lec-alert">');
          else if (cmd === 'accent') tag = keep('<span class="lec-accent">');
          else if (cmd === 'textbf') tag = keep('<span class="lec-b">');
          else if (cmd === 'texttt') tag = keep('<span class="lec-tt">');
          else if (cmd === 'small' || cmd === 'large' || cmd === 'Large' || cmd === 'huge') tag = keep('<span class="lec-size-' + cmd + '">');
          else tag = keep('<span class="lec-em">');
          out += tag + body + keep('</span>');
          i = close + 1;
          continue;
        }
        m = /^\$\$([\s\S]*?)\$\$/.exec(rest) || /^\\\[([\s\S]*?)\\\]/.exec(rest);
        if (m) { out += keep('<span class="lec-display">' + tex(m[1], true) + '</span>'); i += m[0].length; continue; }
        m = /^\$([\s\S]*?)\$/.exec(rest) || /^\\\(([\s\S]*?)\\\)/.exec(rest);
        if (m) { out += keep(tex(m[1], false)); i += m[0].length; continue; }
        // escaped characters: \{ \} \$ \% \& \# \_ and \textbackslash
        if ((m = /^\\([{}$%&#_])/.exec(rest))) { out += keep(esc(m[1])); i += 2; continue; }
        if ((m = /^\\textbackslash(?![a-zA-Z])\s?/.exec(rest))) { out += keep('\\'); i += m[0].length; continue; }
        if ((m = /^\\\\\[\s*(-?\d*\.?\d+)\s*(em|ex|px)?\s*\]/.exec(rest))) {
          out += keep('<br><span class="lec-gap" style="height:' + m[1] + (m[2] || 'px') + '"></span>'); i += m[0].length; continue;
        }
        if (rest.indexOf('\\\\') === 0) { out += keep('<br>'); i += 2; continue; }
        out += s[i++];
      }
      return out;
    }

    var t = walk(String(src));
    t = esc(t).replace(/\u0001(\d+)\u0001/g, function (m, k) { return stash[+k]; });
    return t.replace(/\n/g, ' ');
  }

  /* ---------- parser ----------
     Step model (README-v2.md, "Steps"): every element has an interval of steps.
     Reading a column top to bottom, the counter c is where unmarked content appears,
     and m is the largest step used so far. \pause sets c = m + 1. */
  function parse(source) {
    var meta = { title: '', subtitle: '', section: '', date: '', author: '', copyright: '', engine: '',
      footer: 'section', slidenumbers: 'on', progressbar: 'on', theme: 'default' };
    var lines = String(source || '').replace(/\r/g, '').split('\n');
    var slides = [];
    var section = '';
    var i = 0;
    var lectureThemes = {};

    function newSlide(title, kind) {
      var s = { title: title || '', section: section, kind: kind || 'body', blocks: [], steps: 0, timeline: [], checks: [] };
      slides.push(s);
      return s;
    }

    var cur = null;
    while (i < lines.length) {
      var t = lines[i].trim(), m;
      if (t === '' || t.charAt(0) === '%') { i++; continue; }
      // Tolerate a missing closing brace so half-typed commands still parse.
      if ((m = t.match(/^\\(title|subtitle|date|author|copyright|course|engine|footer|slidenumbers|progressbar|theme)\{([\s\S]*?)\}?$/))) {
        meta[m[1] === 'course' ? 'subtitle' : m[1]] = m[2]; i++; continue;
      }
      if ((m = t.match(/^\\begin\{theme\}\{([^}]*)\}\s*$/))) {
        var tname = m[1].trim(), tbody = [];
        for (i++; i < lines.length && !/^\\end\{theme\}/.test(lines[i].trim()); i++) tbody.push(lines[i]);
        i++;
        lectureThemes[tname] = readThemeBody(tname, tbody);
        continue;
      }
      if (t === '\\titleslide') { cur = newSlide('', 'title'); i++; continue; }
      if ((m = t.match(/^\\section(\*?)\{([\s\S]*?)\}?$/))) {
        section = m[2];
        cur = m[1] ? null : newSlide(m[2], 'divider');
        i++; continue;
      }
      if ((m = t.match(/^\\(?:slide|frame|frametitle)\s*(?:\[([^\]]*)\])?\s*\{([\s\S]*?)\}?$/))) {
        cur = newSlide(m[2]);
        cur.opts = slideOptions(m[1], cur);
        i++; continue;
      }
      if (!cur) cur = newSlide('');
      // gather this slide's body lines
      var body = [], startIdx = i;
      while (i < lines.length) {
        var s2 = lines[i].trim();
        if (/^\\(slide|frame|frametitle|section|titleslide)\b/.test(s2) || /^\\begin\{theme\}/.test(s2)) break;
        if (/^\\(title|subtitle|date|author|copyright|course|engine|footer|slidenumbers|progressbar|theme)\{/.test(s2)) break;
        body.push(lines[i]); i++;
      }
      // Safety net: never leave the outer loop without consuming a line.
      if (i === startIdx) { body.push(lines[i]); i++; }
      var st = newReader(cur);
      cur.blocks = parseBlocks(body, st);
      finishSlide(cur, st);
      cur = null;
    }
    if (!slides.length) slides.push({ title: 'Empty deck', section: '', kind: 'body', blocks: [], steps: 0, timeline: [], checks: [] });
    meta.theme = String(meta.theme || 'default').trim();
    var theme = resolveTheme(meta.theme, lectureThemes);
    meta.themeColors = theme.colors;
    return { meta: meta, slides: slides, themes: lectureThemes, theme: theme, warnings: checkDeck(meta, slides, theme) };
  }

  // \slide[scale=0.9, valign=center, align=left]{Title}
  function slideOptions(opt, slide) {
    var o = options(opt), out = {};
    Object.keys(o.kv).forEach(function (key) {
      var v = o.kv[key].toLowerCase();
      if (key === 'scale') {
        var k = numExpr(v, NaN);
        if (isFinite(k) && k > 0) out.scale = clamp(k, 0.5, 2);
        else slide.checks.push('scale=' + o.kv[key] + ' is not a number');
      } else if (key === 'valign' && /^(top|center|bottom)$/.test(v)) out.valign = v;
      else if (key === 'align' && /^(left|center|right)$/.test(v)) out.align = v;
      else slide.checks.push('unknown slide option ' + key + '=' + o.kv[key]);
    });
    Object.keys(o.flags).forEach(function (f) { slide.checks.push('unknown slide option ' + f); });
    return out;
  }

  function newReader(slide) {
    // width: the space a figure has, in stage pixels (1920 less the slide's side padding)
    return { c: 0, m: -1, slide: slide, figures: 0, stepsOverride: null, width: 1680 };
  }
  // Record that an element occupies [from, to]; its last step in use is `last`.
  function use(st, kind, from, to, extra) {
    var e = { kind: kind, from: from, to: to, only: false };
    for (var k in extra) e[k] = extra[k];
    st.slide.timeline.push(e);
    var last = isFinite(to) ? to : from;
    if (e.lastUsed !== undefined) last = Math.max(last, e.lastUsed);
    st.m = Math.max(st.m, from, last);
    return e;
  }
  function pause(st) { st.c = Math.max(0, st.m + 1); }
  function interval(st, spec) {
    if (!spec) return { from: st.c, to: Infinity };
    return range(spec);
  }
  // Overlay specs written inside text: \uncover<2->{...}, \only<0>{...}
  function scanInline(st, text) {
    colorChecks(st, text);
    var re = /\\(only|uncover|visible)<([^>]*)>/g, m;
    while ((m = re.exec(text))) {
      var r = range(m[2]);
      use(st, 'span', r.from, r.to, { only: m[1] === 'only' });
    }
  }

  // \textcolor with a name the engine does not know, or a color too pale to read on white
  function colorChecks(st, text) {
    var re = /\\textcolor\{\s*([^{}]*?)\s*\}/g, m;
    while ((m = re.exec(text))) {
      var name = m[1], hex = hexColor(name) || (C.hasOwnProperty(name) ? C[name] : null), msg = null;
      if (!hex && !colorClass(name)) msg = 'unknown color ' + name + '; use c1 to c4, a palette name, or #hex';
      else if (hex && !/^c[1-4]$/.test(name)) {
        var r = contrastOnWhite(hex);
        if (r < 3) msg = 'color ' + name + ' is ' + (r < 2.95 ? r.toFixed(1) : r.toFixed(2)) + ':1 on white, below the 3:1 minimum; c1 to c4 are safe';
      }
      if (msg && st.slide.checks.indexOf(msg) < 0) st.slide.checks.push(msg);
    }
  }

  function finishSlide(slide, st) {
    var used = Math.max(0, st.m);
    if (st.stepsOverride !== null) {
      slide.steps = st.stepsOverride;
      if (used > st.stepsOverride) {
        slide.checks.push('\\steps{' + st.stepsOverride + '} hides content that appears at step ' + used);
      }
    } else slide.steps = used;
    checkSteps(slide);
  }

  // Frames a js figure needs, read from literal tests on `local` in its code.
  // For each test we record the frame at which it can first change value.
  var LOCAL_TEST = /\blocal\s*(>=|>|<=|<|===|==|!==|!=)\s*(\d+)|(\d+)\s*(<=|<|>=|>|===|==|!==|!=)\s*local\b/g;
  var FLIP = { '<=': '>=', '<': '>', '>=': '<=', '>': '<', '===': '===', '==': '==', '!==': '!==', '!=': '!=' };
  function readFrames(code) {
    var tests = [], m, re = new RegExp(LOCAL_TEST.source, 'g');
    var clean = code.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    while ((m = re.exec(clean))) {
      var op = m[1] || FLIP[m[4]], k = +(m[2] !== undefined ? m[2] : m[3]);
      var at = (op === '>' || op === '<=') ? k + 1 : k;
      var changes = (op === '===' || op === '==' || op === '!==' || op === '!=') ? [k, k + 1] : [at];
      tests.push({ text: m[0].replace(/\s+/g, ' '), at: at, changes: changes });
    }
    var usesLocal = /\blocal\b/.test(clean);
    // local used other than in a literal test (PRESET[local], local / 3): the figure may
    // change at any frame, so every frame counts as a change.
    var otherUses = (clean.match(/\blocal\b/g) || []).length > tests.length;
    var usesStep = /\bstep\s*(>=|>|<=|<|===|==|!==|!=)\s*\d|\d\s*(<=|<|>=|>|===|==|!==|!=)\s*step\b/.test(clean);
    var needed = tests.reduce(function (a, t) { return Math.max(a, t.at); }, 0);
    return { tests: tests, frames: tests.length ? needed + 1 : 0, usesLocal: usesLocal, otherUses: otherUses, usesStep: usesStep };
  }

  // Idle steps, unreachable tests, and the other checks listed in README-v2.md.
  function checkSteps(slide) {
    var N = slide.steps, tl = slide.timeline;
    tl.forEach(function (e) {
      if (e.kind !== 'figure') return;
      var who = 'figure ' + e.index;
      var n = e.frames;
      if (e.explicitFrames && e.read.tests.length) {
        e.read.tests.forEach(function (t) {
          if (t.at >= n) slide.checks.push(who + ' tests "' + t.text + '", which never changes in its ' + n + ' frame' + (n > 1 ? 's' : ''));
        });
        if (e.read.frames && e.read.frames < n) slide.checks.push(who + ' has frames=' + n + ' but its tests on local use ' + e.read.frames);
      }
      if (e.read.usesLocal && !e.read.tests.length && !e.explicitFrames) {
        slide.checks.push(who + ' uses local in a way the engine cannot count; add frames=');
      }
      if (e.read.usesStep) slide.checks.push(who + ' tests step; local counts from the figure\'s first step');
      if (isFinite(e.to) && e.to - e.from + 1 < n) {
        slide.checks.push(who + ' is visible for ' + (e.to - e.from + 1) + ' step' + (e.to > e.from ? 's' : '') + ' but has ' + n + ' frames');
      }
    });
    for (var s = 1; s <= N; s++) {
      var active = tl.some(function (e) {
        if (e.from === s) return true;
        if (isFinite(e.to) && e.to + 1 === s) return true;
        if (e.kind === 'figure' || e.kind === 'plot') {
          var lastFrame = Math.min(isFinite(e.to) ? e.to : Infinity, e.from + e.frames - 1);
          if (s <= e.from || s > lastFrame) return false;
          if (e.opaque) return true;
          return e.changes.indexOf(s - e.from) >= 0;
        }
        return false;
      });
      if (!active) slide.checks.push('step ' + s + ' changes nothing');
    }
  }

  // Problems worth showing the author: a missing \engine{2} line, formulas in plots
  // that cannot be read, and the step checks for each slide.
  function checkDeck(meta, slides, theme) {
    var out = [];
    if (theme) {
      theme.problems.forEach(function (p) { out.push(p); });
      if (theme.name !== 'default') themeContrastProblems(theme.colors).forEach(function (p) { out.push('theme ' + theme.name + ': ' + p); });
    }
    if (String(meta.engine).trim() !== '2') {
      out.push(meta.engine ? 'this source asks for engine ' + meta.engine + ', not 2'
        : 'no \\engine{2} line; this may be v1 source');
    }
    slides.forEach(function (s, si) {
      var where = 'slide ' + (si + 1);
      (function walk(bs) {
        bs.forEach(function (b) {
          if (b.type === 'plot') {
            [['f', b.cfg.f], ['f2', b.cfg.f2]].forEach(function (pair) {
              if (!pair[1]) return;
              var c = compileExpr(pair[1]);
              if (c.error) out.push(where + ', ' + pair[0] + ': ' + c.error.message);
              c.warnings.forEach(function (w) { out.push(where + ', ' + pair[0] + ': ' + w); });
            });
            var T = (theme && theme.colors) || DEFAULT_THEME;
            [['style', b.cfg.style], ['style2', b.cfg.style2], ['secant.style', b.cfg.secantStyle], ['tangent.style', b.cfg.tangentStyle]]
              .forEach(function (st) {
                String(st[1] || '').split(',').forEach(function (part) {
                  var q = part.trim();
                  if (!q || DASHES.hasOwnProperty(q) || /^\d+(\.\d+)?$/.test(q)) return;
                  var col = plotColor(q, T);
                  if (!col) out.push(where + ', ' + st[0] + ': ' + q + ' is not a color, dash (solid, dashed, dotted), or width');
                  else if (contrastRatio(col, T.background) < 3) {
                    out.push(where + ', ' + st[0] + ': ' + q + ' is ' + contrastRatio(col, T.background).toFixed(1) + ':1 on the background, below 3:1');
                  }
                });
              });
          }
          if (b.blocks) walk(b.blocks);
          if (b.cols) b.cols.forEach(walk);
        });
      })(s.blocks);
      (s.checks || []).forEach(function (c) { if (c.charAt(0) !== '~') out.push(where + ': ' + c); });
    });
    // missing alt text last, so it never hides a problem that breaks a slide
    slides.forEach(function (s, si) {
      (s.checks || []).forEach(function (c) { if (c.charAt(0) === '~') out.push('slide ' + (si + 1) + ': ' + c.slice(1)); });
    });
    return out;
  }

  var BEGIN_RE = /^\\begin\{([\w*]+)\}\s*(?:<([^>]*)>)?\s*(?:\[([^\]]*)\])?\s*(?:\{([\s\S]*)\})?\s*$/;
  function parseBlocks(lines, st) {
    var blocks = [], i = 0;
    while (i < lines.length) {
      var t = lines[i].trim(), m;
      if (t === '' || t.charAt(0) === '%') { i++; continue; }
      if (t === '\\pause') { pause(st); i++; continue; }
      if ((m = t.match(/^\\steps\{(\d+)\}$/))) { st.stepsOverride = +m[1]; i++; continue; }
      if ((m = t.match(/^\\heading(?:<([^>]*)>)?\{([\s\S]*)\}$/))) {
        var rh = interval(st, m[1]);
        use(st, 'text', rh.from, rh.to, { label: m[2].slice(0, 40) });
        colorChecks(st, m[2]);
        blocks.push({ type: 'heading', text: m[2], from: rh.from, to: rh.to }); i++; continue;
      }
      if ((m = t.match(/^\\vspace\{\s*(-?\d*\.?\d+)\s*(em|ex|px)?\s*\}$/))) {
        blocks.push({ type: 'space', size: m[1] + (m[2] || 'px') }); i++; continue;
      }
      if ((m = t.match(/^\\timer(?:<([^>]*)>)?\{([^}]*)\}$/))) {
        var rt = interval(st, m[1]), secs = seconds(m[2]);
        if (!(secs > 0)) st.slide.checks.push('\\timer{' + m[2] + '} needs a number of seconds, or m:ss');
        use(st, 'timer', rt.from, rt.to);
        blocks.push({ type: 'timer', secs: secs > 0 ? secs : 60, from: rt.from, to: rt.to }); i++; continue;
      }
      if (t === '\\medskip' || t === '\\bigskip' || t === '\\vfill') {
        blocks.push({ type: 'space', size: t === '\\vfill' ? 'fill' : (t === '\\bigskip' ? 44 : 22) }); i++; continue;
      }
      if ((m = t.match(/^\\imageslot\{([^}]*)\}\s*(?:\{([\s\S]*)\})?\s*$/))) {
        use(st, 'image', st.c, Infinity);
        blocks.push({ type: 'image', id: m[1], caption: m[2] || '', from: st.c }); i++; continue;
      }
      if ((m = t.match(BEGIN_RE))) {
        var env = m[1], spec = m[2] || '', opt = m[3] || '', arg = m[4] || '';
        var inner = [], depth = 1; i++;
        while (i < lines.length) {
          var s2 = lines[i].trim();
          if (s2.indexOf('\\begin{' + env + '}') === 0) depth++;
          if (s2.indexOf('\\end{' + env + '}') === 0) { depth--; if (!depth) break; }
          inner.push(lines[i]); i++;
        }
        i++;
        blocks.push(makeEnv(env, spec, opt, arg, inner, st));
        continue;
      }
      var para = [], startIdx = i;
      while (i < lines.length) {
        var s3 = lines[i].trim();
        if (s3 === '' || s3 === '\\pause' || /^\\(begin|imageslot|medskip|bigskip|vfill|steps|heading|vspace|timer)\b/.test(s3)) break;
        para.push(lines[i]); i++;
      }
      // Half-typed \begin{ / \imageslot{ etc: consume the line rather than spin.
      if (i === startIdx) { para.push(lines[i]); i++; }
      if (para.length) {
        var text = para.join('\n');
        use(st, 'text', st.c, Infinity, { label: text.slice(0, 40) });
        scanInline(st, text);
        blocks.push({ type: 'para', text: text, from: st.c });
      }
    }
    return blocks;
  }

  // "90" or "1:30"
  function seconds(v) {
    var m = String(v || '').trim().match(/^(\d+):(\d{1,2})$/);
    if (m) return +m[1] * 60 + +m[2];
    var n = numExpr(v, NaN);
    return isFinite(n) ? Math.round(n) : NaN;
  }

  // Options like "5 7, parallel, gap=40" or 'size=900x500, caption="Two curves, one tangent"'.
  // A value in double quotes may contain commas.
  function options(opt) {
    var out = { nums: [], flags: {}, kv: {} };
    var re = /\s*(?:(\w+)\s*=\s*("([^"]*)"|[^,]*)|([^,]*))\s*(?:,|$)/g, m, src = String(opt || '');
    while (re.lastIndex < src.length && (m = re.exec(src))) {
      if (m[0] === '') { re.lastIndex++; continue; }
      if (m[1]) { out.kv[m[1].toLowerCase()] = (m[3] !== undefined ? m[3] : m[2]).trim(); continue; }
      var p = (m[4] || '').trim();
      if (!p) continue;
      if (/^[\d.\s:]+$/.test(p)) out.nums = out.nums.concat(p.split(/[\s:]+/).filter(Boolean).map(Number));
      else out.flags[p.toLowerCase()] = true;
    }
    return out;
  }

  function splitColumns(lines) {
    var cols = [[]], depth = 0;
    lines.forEach(function (ln) {
      var t = ln.trim();
      if (/^\\begin\{columns\}/.test(t)) depth++;
      if (/^\\end\{columns\}/.test(t)) depth--;
      if (!depth && (t === '\\columnbreak' || t === '\\column')) { cols.push([]); return; }
      cols[cols.length - 1].push(ln);
    });
    return cols;
  }

  function makeEnv(env, spec, opt, arg, lines, st) {
    // An overlay spec on a block environment wraps the whole block in that interval.
    if (spec && env !== 'js' && env !== 'plot' && env !== 'uncover' && env !== 'only') {
      var r0 = range(spec);
      use(st, 'block', r0.from, r0.to);
      var innerBlock = makeEnv(env, '', opt, arg, lines, st);
      return { type: 'gate', from: r0.from, to: r0.to, only: false, blocks: [innerBlock] };
    }
    if (env === 'uncover' || env === 'only') {
      var r1 = interval(st, spec);
      use(st, 'block', r1.from, r1.to, { only: env === 'only' });
      return { type: 'gate', from: r1.from, to: r1.to, only: env === 'only', blocks: parseBlocks(lines, st) };
    }
    if (env === 'center' || env === 'flushright' || env === 'flushleft') {
      return { type: 'align', how: env, blocks: parseBlocks(lines, st) };
    }
    if (env === 'youtry') {
      var oy = options(opt), secsY = oy.nums.length ? oy.nums[0] : oy.kv.time !== undefined ? seconds(oy.kv.time) : 60;
      if (/^(none|off|0)$/i.test(String(oy.kv.time || '')) || oy.flags.notimer) secsY = 0;
      var fromY = st.c, wY = st.width;
      use(st, 'box', fromY, Infinity);
      st.width = wY - 62;
      var innerY = parseBlocks(lines, st);
      st.width = wY;
      if (secsY > 0) use(st, 'timer', fromY, Infinity);
      return { type: 'box', kind: 'youtry', name: arg, blocks: innerY, from: fromY, timer: secsY > 0 ? secsY : 0 };
    }
    if (env === 'itemize' || env === 'enumerate') {
      var items = [], cur = null;
      lines.forEach(function (ln) {
        var t = ln.trim();
        if (t === '\\pause') { pause(st); return; }
        var m = t.match(/^\\item\s*(?:<([^>]*)>)?\s*(?:\[([^\]]*)\])?\s*([\s\S]*)$/);
        if (m) {
          var r = interval(st, m[1]);
          use(st, 'item', r.from, r.to, { label: m[3].slice(0, 40) });
          cur = { text: m[3], marker: m[2] === undefined ? null : m[2], from: r.from, to: r.to, sub: /^\s{2,}/.test(ln) };
          items.push(cur);
        }
        else if (cur) cur.text += '\n' + t;
      });
      items.forEach(function (it) { scanInline(st, it.text); });
      return { type: 'list', ordered: env === 'enumerate', items: items, tight: /tight/.test(opt) };
    }
    if (env === 'align' || env === 'align*' || env === 'equation' || env === 'gather') {
      var groups = [], g = [], from0 = st.c;
      function flush() {
        var src = g.join('\n');
        if (src.trim()) { use(st, 'math', st.c, Infinity); colorChecks(st, src); groups.push({ src: src, from: st.c }); }
        g = [];
      }
      lines.forEach(function (ln) {
        if (ln.trim() === '\\pause') { flush(); pause(st); }
        else g.push(ln);
      });
      flush();
      if (!groups.length) groups.push({ src: '', from: from0 });
      return { type: 'math', groups: groups, env: env === 'equation' ? 'equation' : 'aligned' };
    }
    if (env === 'theorem' || env === 'definition' || env === 'example' || env === 'note' || env === 'proof' ||
        env === 'question' || env === 'box') {
      var from = st.c, w0 = st.width;
      use(st, 'box', from, Infinity);
      st.width = w0 - (env === 'box' ? 60 : 62);
      var inner = parseBlocks(lines, st);
      st.width = w0;
      return { type: 'box', kind: env, name: arg, blocks: inner, from: from };
    }
    if (env === 'columns') {
      var o = options(opt), parts = splitColumns(lines), cols;
      var ratio = parts.map(function (_, k) { return o.nums[k] > 0 ? o.nums[k] : 1; });
      var gap = num(o.kv.gap, 56), total = ratio.reduce(function (a, b) { return a + b; }, 0), wC = st.width;
      var colWidth = function (k) { return (wC - gap * (ratio.length - 1)) * ratio[k] / total; };
      if (o.flags.parallel) {
        var c0 = st.c, m0 = st.m, cEnd = st.c, mEnd = st.m;
        cols = parts.map(function (colLines, k) {
          st.c = c0; st.m = m0; st.width = colWidth(k);
          var bl = parseBlocks(colLines, st);
          cEnd = Math.max(cEnd, st.c); mEnd = Math.max(mEnd, st.m);
          return bl;
        });
        st.c = cEnd; st.m = mEnd;
      } else {
        cols = parts.map(function (colLines, k) { st.width = colWidth(k); return parseBlocks(colLines, st); });
      }
      st.width = wC;
      return { type: 'cols', cols: cols, ratio: ratio, gap: gap };
    }
    if (env === 'table' || env === 'tabular') {
      var rows = [], fromT = st.c;
      lines.forEach(function (ln) {
        var t = ln.trim().replace(/\\\\\s*$/, '');
        if (!t || t === '\\hline') return;
        rows.push(t.split('&').map(function (c) { return c.trim(); }));
      });
      use(st, 'table', fromT, Infinity);
      rows.forEach(function (row) { row.forEach(function (c) { scanInline(st, c); }); });
      return { type: 'table', rows: rows, header: !/noheader/.test(opt), from: fromT };
    }
    if (env === 'plot') {
      var cfg = plotConfig(lines.join('\n'), opt);
      var rp = interval(st, spec);
      cfg.from = rp.from; cfg.to = rp.to;
      cfg.unknown.forEach(function (u) { st.slide.checks.push('plot ' + (st.figures + 1) + ': unknown setting ' + u); });
      if (cfg.w > st.width + 1) {
        st.slide.checks.push('plot ' + (st.figures + 1) + ' is ' + cfg.w + 'px wide but its column is ' + Math.floor(st.width) + 'px; it will shrink to fit');
      }
      var nP = cfg.animate ? cfg.frames : 1;
      cfg.frames = nP;
      st.figures++;
      use(st, 'plot', rp.from, rp.to, { frames: nP, opaque: true, index: st.figures, lastUsed: Math.min(rp.from + nP - 1, rp.to) });
      return { type: 'plot', cfg: cfg };
    }
    if (env === 'js') {
      var oj = options(opt), code = lines.join('\n');
      var sz = String(oj.kv.size || '900x480').split(/\s*x\s*/);
      var read = readFrames(code);
      var explicit = oj.kv.frames !== undefined ? Math.max(1, num(oj.kv.frames, 1)) : 0;
      var n = explicit || read.frames || 1;
      var rj = interval(st, spec);
      var changes = [];
      read.tests.forEach(function (t) { changes = changes.concat(t.changes); });
      st.figures++;
      if (!oj.kv.alt && !oj.kv.caption) st.slide.checks.push('~figure ' + st.figures + ' has no alt text');
      if (num(sz[0], 900) > st.width + 1) {
        st.slide.checks.push('figure ' + st.figures + ' is ' + num(sz[0], 900) + 'px wide but its column is ' + Math.floor(st.width) + 'px; it will shrink to fit');
      }
      use(st, 'figure', rj.from, rj.to, {
        frames: n, explicitFrames: !!explicit, read: read, changes: changes,
        opaque: read.otherUses || (!read.tests.length && explicit > 1), index: st.figures, lastUsed: Math.min(rj.from + n - 1, rj.to)
      });
      return {
        type: 'js', code: code, w: num(sz[0], 900), h: num(sz[1], 480), from: rj.from, to: rj.to, frames: n,
        caption: oj.kv.caption || '', alt: oj.kv.alt || ''
      };
    }
    // unknown environment: keep its contents as ordinary blocks
    st.slide.checks.push(env === 'twocol' ? '\\begin{twocol} is \\begin{columns} in v2' : 'unknown environment \\begin{' + env + '}');
    return { type: 'group', blocks: parseBlocks(lines, st) };
  }

  // "lo:hi" where each end may be a constant formula such as -pi or 3/2
  function pair(v, d) {
    var parts = String(v).split(':');
    if (parts.length !== 2) parts = String(v).split(',');
    if (parts.length !== 2) return d;
    var lo = numExpr(parts[0], NaN), hi = numExpr(parts[1], NaN);
    return isFinite(lo) && isFinite(hi) ? [lo, hi] : d;
  }
  // "f(x)=x^2 @ 1.5": the label's math, and where along x to put it (default: near the right end)
  function curveLabel(v) {
    var at = null, m = String(v).match(/^([\s\S]*?)\s+@\s+(\S+)\s*$/);
    if (m) { at = numExpr(m[2], null); v = m[1]; }
    v = v.trim().replace(/^\$([\s\S]*)\$$/, '$1');
    return v ? { tex: v, at: at } : null;
  }
  // The y-range used when a plot gives none: the curves' extent, padded, and including 0.
  function autoRange(f, f2, x0, x1) {
    var lo = Infinity, hi = -Infinity;
    for (var k = 0; k <= 400; k++) {
      var xx = x0 + (x1 - x0) * k / 400, yy = f(xx);
      if (isFinite(yy)) { lo = Math.min(lo, yy); hi = Math.max(hi, yy); }
      if (f2) { var y2 = f2(xx); if (isFinite(y2)) { lo = Math.min(lo, y2); hi = Math.max(hi, y2); } }
    }
    if (!isFinite(lo)) { lo = -1; hi = 1; }
    var padv = (hi - lo || 2) * 0.16;
    return [Math.min(lo - padv, 0), hi + padv];
  }
  // Plot margins around the drawing area, in canvas pixels.
  function plotMargins(readout) { return { l: 74, r: 26, t: readout ? 74 : 26, b: 62 }; }
  // Tick labels in multiples of pi: 3π/2, −π, π/4.
  function piLabel(v) {
    var r = v / Math.PI;
    for (var q = 1; q <= 12; q++) {
      var p = Math.round(r * q);
      if (Math.abs(r * q - p) < 1e-6) {
        if (p === 0) return '0';
        var g = gcd(p, q); p /= g; var qq = q / g;
        var sign = p < 0 ? '\u2212' : '', ap = Math.abs(p);
        return sign + (ap === 1 ? '' : ap) + '\u03c0' + (qq === 1 ? '' : '/' + qq);
      }
    }
    return fmt(v);
  }
  function plotConfig(body, opt) {
    var cfg = {
      f: 'x^2', f2: '', domain: [-1, 3], range: null, a: 1, hval: 1.5, secant: false, tangent: false,
      riemann: 0, rtype: 'left', area: null, grid: true, w: 980, h: 520, frames: 6,
      animate: null, xlabel: 'x', ylabel: 'y', caption: '', readout: null, points: '',
      label: null, label2: null, style: '', style2: '', secantStyle: '', tangentStyle: '', unknown: [],
      xticks: 0, yticks: 0, xticksPi: false, yticksPi: false, aspect: '', holes: '', holes2: '', sizeGiven: 0
    };
    (body + '\n' + opt.replace(/,/g, '\n')).split('\n').forEach(function (ln) {
      ln = ln.replace(/(^|[^\\])%.*$/, '$1');   // % starts a comment; \% is a percent sign
      var m = ln.trim().match(/^([\w.]+)\s*=\s*([\s\S]*)$/);
      if (!m) return;
      var k = m[1].toLowerCase(), v = m[2].trim();
      switch (k) {
        case 'f': case 'fn': cfg.f = v; break;
        case 'f2': cfg.f2 = v; break;
        case 'domain': cfg.domain = pair(v, cfg.domain); break;
        case 'range': cfg.range = /auto/i.test(v) ? null : pair(v, null); break;
        case 'a': cfg.a = numExpr(v, 1); break;
        case 'h': cfg.hval = numExpr(v, 1.5); break;
        case 'secant': cfg.secant = bool(v, true); break;
        case 'tangent': cfg.tangent = bool(v, true); break;
        case 'riemann': cfg.riemann = num(v, 0); break;
        case 'rtype': cfg.rtype = v.toLowerCase(); break;
        case 'area': cfg.area = pair(v, null); break;
        case 'grid': cfg.grid = bool(v, true); break;
        case 'size':
          var s = v.split(/[x,\s]+/).filter(Boolean);
          cfg.w = Math.min(1680, num(s[0], 980)); cfg.h = Math.min(760, num(s[1], 520)); cfg.sizeGiven = s.length;
          break;
        case 'xticks': cfg.xticks = numExpr(v, 0); cfg.xticksPi = /pi|\u03c0/.test(v); break;
        case 'yticks': cfg.yticks = numExpr(v, 0); cfg.yticksPi = /pi|\u03c0/.test(v); break;
        case 'aspect': cfg.aspect = v.toLowerCase(); break;
        case 'holes': cfg.holes = v; break;
        case 'holes2': cfg.holes2 = v; break;
        case 'frames': cfg.frames = Math.max(2, num(v, 6)); break;
        case 'xlabel': cfg.xlabel = v; break;
        case 'ylabel': cfg.ylabel = v; break;
        case 'caption': cfg.caption = v; break;
        case 'alt': cfg.alt = v; break;
        case 'label': cfg.label = curveLabel(v); break;
        case 'label2': cfg.label2 = curveLabel(v); break;
        case 'style': cfg.style = v; break;
        case 'style2': cfg.style2 = v; break;
        case 'secant.style': cfg.secantStyle = v; break;
        case 'tangent.style': cfg.tangentStyle = v; break;
        case 'points': cfg.points = v; break;
        case 'readout': cfg.readout = bool(v, true); break;
        case 'animate':
          var am = v.match(/^(\w+)\s*:\s*(-?[\d.]+)\s*(?:->|to)\s*(-?[\d.]+)$/);
          if (am) cfg.animate = { key: am[1].toLowerCase(), from: +am[2], to: +am[3] };
          else cfg.unknown.push('animate = ' + v + ' (write h: 1.5 -> 0.05)');
          break;
        default: cfg.unknown.push(m[1]);
      }
    });
    if (cfg.readout === null) cfg.readout = !!(cfg.secant || cfg.riemann || cfg.animate);
    // aspect = equal: one unit on x is as long as one unit on y. The height follows from the
    // width and the window; if that is too tall, the width shrinks instead.
    if (cfg.aspect === 'equal') {
      var M = plotMargins(cfg.readout), xs = cfg.domain[1] - cfg.domain[0];
      var yr = cfg.range || autoRange(compile(cfg.f), cfg.f2 ? compile(cfg.f2) : null, cfg.domain[0], cfg.domain[1]);
      var ys = yr[1] - yr[0];
      if (xs > 0 && ys > 0) {
        if (!cfg.range) cfg.range = yr;
        var ph = (cfg.w - M.l - M.r) * ys / xs;
        if (ph + M.t + M.b > 760) { ph = 760 - M.t - M.b; cfg.w = Math.round(ph * xs / ys + M.l + M.r); }
        cfg.h = Math.round(ph + M.t + M.b);
      }
    } else if (cfg.aspect) cfg.unknown.push('aspect = ' + cfg.aspect + ' (the only choice is equal)');
    return cfg;
  }

  /* ---------- block rendering ---------- */
  function gate(from, to, hide) {
    var s = ' data-from="' + (from || 0) + '"';
    if (to !== undefined && to !== Infinity) s += ' data-to="' + to + '"';
    if (hide) s += ' data-hide="' + hide + '"';
    return s;
  }
  var SC = 1; // deck type scale; a slide's own scale multiplies it (\slide[scale=0.9])
  // Canvas text sizes, with the same 19px floor as the stylesheet.
  function pxk(n, k) { return Math.max(19, Math.round(n * (k || SC))); }

  function renderBlocks(blocks) {
    return blocks.map(renderBlock).join('');
  }
  function renderBlock(b) {
    switch (b.type) {
      case 'para':
        return '<p class="lec-p"' + gate(b.from) + '>' + inline(b.text) + '</p>';
      case 'space':
        if (b.size === 'fill') return '<div class="lec-fill"></div>';
        if (typeof b.size === 'number') return '<div class="lec-space-' + b.size + '"></div>';
        return '<div style="height:' + b.size + '"></div>';
      case 'heading':
        return '<h3 class="lec-heading"' + gate(b.from, b.to) + '>' + inline(b.text) + '</h3>';
      case 'align':
        return '<div class="lec-align--' + b.how + '">' + renderBlocks(b.blocks) + '</div>';
      case 'timer':
        return timerHTML(b.secs, b.from, b.to);
      case 'list':
        var tag = b.ordered ? 'ol' : 'ul';
        return '<' + tag + ' class="lec-list' + (b.tight ? ' lec-list--tight' : '') + '">' +
          b.items.map(function (it, k) {
            var mark;
            if (it.marker !== null && it.marker !== undefined) {
              mark = it.marker === '' ? '<span class="lec-mark--none"></span>'
                : '<span class="lec-mark">' + inline(it.marker) + '</span>';
            } else if (b.ordered) {
              mark = '<span class="lec-mark lec-mark--num">' + (k + 1) + '.</span>';
            } else {
              mark = '<span class="lec-dot' + (it.sub ? ' lec-dot--sub' : '') + '" aria-hidden="true"></span>';
            }
            return '<li class="lec-li' + (it.sub ? ' lec-li--sub' : '') + '"' + gate(it.from, it.to) + '>' +
              mark + '<span class="lec-item">' + inline(it.text) + '</span></li>';
          }).join('') + '</' + tag + '>';
      case 'math':
        return '<div class="lec-math">' +
          b.groups.map(function (g) {
            if (!g.src.trim()) return '';
            var src = b.env === 'equation' ? g.src : '\\begin{aligned}' + g.src + '\\end{aligned}';
            return '<div class="lec-math-line"' + gate(g.from) + '>' + tex(src, true) + '</div>';
          }).join('') + '</div>';
      case 'box':
        // box: an outlined panel with no label, for posing a problem or setting text apart
        if (b.kind === 'box') return '<div class="lec-panel"' + gate(b.from) + '>' + renderBlocks(b.blocks) + '</div>';
        var titles = { theorem: 'Theorem', definition: 'Definition', example: 'Example', note: 'Note', proof: 'Proof',
          question: 'Question', youtry: 'You Try' };
        return '<div class="lec-box lec-box--' + b.kind + '"' + gate(b.from) + '>' +
          '<div class="lec-box-label">' + (titles[b.kind] || esc(b.kind)) +
          (b.name ? ' &middot; <span class="lec-box-name">' + inline(b.name) + '</span>' : '') + '</div>' +
          renderBlocks(b.blocks) + (b.timer ? timerHTML(b.timer) : '') + '</div>';
      case 'cols':
        return '<div class="lec-cols" style="grid-template-columns:' + b.ratio.map(function (r) { return r + 'fr'; }).join(' ') +
          ';gap:' + b.gap + 'px">' +
          b.cols.map(function (c) { return '<div class="lec-col">' + renderBlocks(c) + '</div>'; }).join('') + '</div>';
      case 'gate':
        return '<div' + gate(b.from, b.to, b.only ? 'none' : '') + '>' + renderBlocks(b.blocks) + '</div>';
      case 'table':
        return '<table class="lec-table"' + gate(b.from) + '>' +
          b.rows.map(function (row, ri) {
            var head = b.header && ri === 0, cell = head ? 'th' : 'td';
            return '<tr>' + row.map(function (c) {
              return '<' + cell + (head ? ' scope="col"' : '') + '>' + inline(c) + '</' + cell + '>';
            }).join('') + '</tr>';
          }).join('') + '</table>';
      case 'image':
        return '<figure class="lec-imageslot" data-imageslot="' + escAttr(b.id) + '" data-alt="' + escAttr(plainText(b.caption)) + '"' + gate(b.from) + '>' +
          '<div class="lec-drop" data-drop="1"><span class="lec-drop-hint" data-hint="1">drop image &rarr; <b>' + esc(b.id) + '</b></span></div>' +
          (b.caption ? '<figcaption class="lec-caption">' + inline(b.caption) + '</figcaption>' : '') +
          '</figure>';
      case 'plot':
        return '<figure class="lec-figure" data-plot="' + escAttr(JSON.stringify(b.cfg)) + '"' + gate(b.cfg.from, b.cfg.to) + '>' +
          '<div class="lec-plot-wrap" style="width:' + b.cfg.w + 'px">' +
          '<canvas class="lec-canvas" role="img" aria-label="' + escAttr(plotAlt(b.cfg)) + '" style="aspect-ratio:' + b.cfg.w + '/' + b.cfg.h + '"></canvas>' +
          '<div class="lec-plot-labels" aria-hidden="true">' +
          [b.cfg.label, b.cfg.label2].map(function (l, k) {
            return l ? '<span class="lec-plot-label" data-curve="' + (k ? 'f2' : 'f') + '">' + tex(l.tex, false) + '</span>' : '';
          }).join('') + '</div></div>' +
          (b.cfg.caption ? '<figcaption class="lec-caption">' + inline(b.cfg.caption) + '</figcaption>' : '') +
          '</figure>';
      case 'js':
        var alt = b.alt || b.caption;
        return '<figure class="lec-figure" data-js="1" data-js-from="' + b.from + '" data-js-to="' + b.to + '" data-frames="' + b.frames + '"' +
          gate(b.from, b.to) + '>' +
          '<canvas class="lec-canvas" data-w="' + b.w + '" data-h="' + b.h + '"' + (alt ? ' role="img" aria-label="' + escAttr(alt) + '"' : '') +
          ' style="width:' + b.w + 'px;height:' + b.h + 'px"></canvas>' +
          '<script type="text/x-lecture-js">' + b.code.replace(/<\//g, '<\\/') + '<\/script>' +
          (b.caption ? '<figcaption class="lec-caption">' + esc(b.caption) + '</figcaption>' : '') +
          '</figure>';
      case 'group': return renderBlocks(b.blocks);
      default: return '';
    }
  }
  function clock(t) {
    var n = Math.max(0, Math.ceil(t)), m = Math.floor(n / 60), sec = n - 60 * m;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function timerHTML(secs, from, to) {
    return '<div class="lec-timer-wrap"' + (from === undefined ? '' : gate(from, to)) + '>' +
      '<button type="button" class="lec-timer" data-timer="' + secs + '" aria-label="Timer, ' + clock(secs) + '. Press to pause or restart.">' +
      '<span class="lec-timer-digits" role="timer">' + clock(secs) + '</span>' +
      '<span class="lec-timer-track" aria-hidden="true"><span class="lec-timer-fill"></span></span></button>' +
      '<span class="lec-sr" aria-live="polite"></span></div>';
  }

  // Text for screen readers: formulas and commands reduced to their words.
  function plainText(s) {
    return String(s || '').replace(/\$([^$]*)\$/g, '$1').replace(/\\[a-zA-Z]+\*?/g, ' ').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  }
  function plotAlt(cfg) {
    if (cfg.alt) return cfg.alt;
    var s = 'Graph of y = ' + cfg.f + (cfg.label ? ' (labeled ' + cfg.label.tex + ')' : '') +
      (cfg.f2 ? ' and y = ' + cfg.f2 + (cfg.label2 ? ' (labeled ' + cfg.label2.tex + ')' : '') : '') +
      ' for x from ' + fmt(cfg.domain[0]) + ' to ' + fmt(cfg.domain[1]);
    if (cfg.tangent) s += ', with the tangent line at x = ' + fmt(cfg.a);
    return s;
  }

  function slideHTML(slide, meta) {
    var o = slide.opts || {};
    var k = Math.round(SC * (o.scale || 1) * 1000) / 1000;
    var vars = themeStyle(meta && meta.themeColors);
    var open = function (kind) { return '<div class="lec-slide lec-slide--' + kind + '" style="--k:' + k + (vars ? ';' + vars : '') + '">'; };
    if (slide.kind === 'title') {
      return open('title') +
        '<div class="lec-kicker">' + esc(meta.subtitle || '') + '</div>' +
        '<h1 class="lec-title">' + inline(meta.title || '') + '</h1>' +
        '<div class="lec-title-gap"></div>' +
        '<div class="lec-author">' + esc(meta.author || '') + '</div>' +
        '<div class="lec-date">' + esc(meta.date || '') + '</div>' +
        renderBlocks(slide.blocks) + '</div>';
    }
    if (slide.kind === 'divider') {
      return open('divider') +
        '<div class="lec-kicker">Section</div>' +
        '<h2 class="lec-divider-title">' + inline(slide.title) + '</h2>' +
        renderBlocks(slide.blocks) + '</div>';
    }
    var fill = slide.blocks.some(function (b) { return b.type === 'space' && b.size === 'fill'; });
    var body = 'lec-body' + (fill ? ' lec-body--fill' : '') + (o.valign === 'center' ? ' lec-body--center' : o.valign === 'bottom' ? ' lec-body--bottom' : '') +
      (o.align === 'center' ? ' lec-body--align-center' : o.align === 'right' ? ' lec-body--align-right' : '');
    return open('body') +
      (slide.title ? '<h2 class="lec-h">' + inline(slide.title) + '</h2>' : '') +
      '<div class="lec-flow" data-flow="1"><div class="' + body + '">' + renderBlocks(slide.blocks) + '</div></div></div>';
  }

  /* ---------- plot drawing ---------- */
  function niceStep(span, target) {
    var raw = span / target, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }
  function fmt(v) {
    if (Math.abs(v) < 1e-9) return '0';
    var a = Math.abs(v);
    return (a < 0.01 ? v.toExponential(1) : a < 1 ? v.toFixed(2) : a < 10 ? String(Math.round(v * 100) / 100) : String(Math.round(v * 10) / 10));
  }
  function fmtTick(v, step) {
    if (Math.abs(v) < step * 1e-6) return '0';
    var d = Math.max(0, Math.min(6, Math.ceil(-Math.log(step) / Math.LN10) + 0.0001 | 0));
    if (step < 1) d = Math.max(d, 1);
    return v.toFixed(d).replace(/^-/, '\u2212');
  }
  // "c1, dashed, 3": a color (theme role, palette name, or hex), a dash, and a width in pixels
  function plotStyle(spec, T, color, width, dash) {
    var out = { color: color, width: width, dash: DASHES[dash] };
    String(spec || '').split(',').forEach(function (part) {
      var p = part.trim();
      if (!p) return;
      if (DASHES.hasOwnProperty(p)) out.dash = DASHES[p];
      else if (/^\d+(\.\d+)?$/.test(p)) out.width = clamp(+p, 1, 12);
      else { var c = plotColor(p, T); if (c) out.color = c; }
    });
    return out;
  }
  var DASHES = { solid: [], dashed: [12, 8], dotted: [2, 9] };
  function plotColor(name, T) {
    T = T || DEFAULT_THEME;
    if (T.hasOwnProperty(name) && !/fill$|^background$/.test(name)) return T[name];
    if (T.hasOwnProperty('plot.' + name)) return T['plot.' + name];
    return colorValue(name);
  }
  function drawPlot(canvas, cfg, av) {
    var T = cfg.themeColors || DEFAULT_THEME;
    var S = {
      f: plotStyle(cfg.style, T, T['plot.curve'], 4, 'solid'),
      f2: plotStyle(cfg.style2, T, T['plot.curve2'], 3, 'dashed'),
      secant: plotStyle(cfg.secantStyle, T, T['plot.secant'], 4, 'solid'),
      tangent: plotStyle(cfg.tangentStyle, T, T['plot.tangent'], 3, 'dashed')
    };
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = cfg.w, H = cfg.h;
    canvas.width = W * dpr; canvas.height = H * dpr;
    var g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    var f = compile(cfg.f), f2 = cfg.f2 ? compile(cfg.f2) : null;
    var x0 = cfg.domain[0], x1 = cfg.domain[1];
    var h = cfg.animate && cfg.animate.key === 'h' ? av : cfg.hval;
    var nR = cfg.riemann ? Math.max(1, Math.round(cfg.animate && cfg.animate.key === 'n' ? av : cfg.riemann)) : 0;

    var zoomR = null;
    if (cfg.animate && cfg.animate.key === 'zoom') {
      var zh = Math.abs(av), za = cfg.a;
      x0 = za - zh; x1 = za + zh;
      var eh0 = 1e-5, slope = Math.abs((f(za + eh0) - f(za - eh0)) / (2 * eh0));
      var yh = Math.max(slope, 0.4) * zh * 1.5;
      var fc = f(za);
      zoomR = [fc - yh, fc + yh];
    }

    var y0, y1, yr = zoomR || cfg.range || autoRange(f, f2, x0, x1);
    y0 = yr[0]; y1 = yr[1];

    var M = plotMargins(cfg.readout);
    var pw = W - M.l - M.r, ph = H - M.t - M.b;
    function X(x) { return M.l + (x - x0) / (x1 - x0) * pw; }
    function Y(y) { return M.t + ph - (y - y0) / (y1 - y0) * ph; }

    // grid
    var sx = cfg.xticks > 0 && (x1 - x0) / cfg.xticks <= 60 ? cfg.xticks : niceStep(x1 - x0, 8);
    var sy = cfg.yticks > 0 && (y1 - y0) / cfg.yticks <= 60 ? cfg.yticks : niceStep(y1 - y0, 6);
    g.font = pxk(19, cfg.k) + 'px ' + FM.replace(/'/g, '"');
    if (cfg.grid) {
      g.strokeStyle = T['plot.grid']; g.lineWidth = 1;
      for (var jx = Math.ceil(x0 / sx - 1e-9), gx = jx * sx; gx <= x1 + 1e-9; jx++, gx = jx * sx) {
        g.beginPath(); g.moveTo(X(gx), M.t); g.lineTo(X(gx), M.t + ph); g.stroke();
      }
      for (var jy = Math.ceil(y0 / sy - 1e-9), gy = jy * sy; gy <= y1 + 1e-9; jy++, gy = jy * sy) {
        g.beginPath(); g.moveTo(M.l, Y(gy)); g.lineTo(M.l + pw, Y(gy)); g.stroke();
      }
    }

    // riemann / area
    var sum = 0;
    if (nR) {
      var alo = cfg.area ? cfg.area[0] : x0, ahi = cfg.area ? cfg.area[1] : x1;
      var dw = (ahi - alo) / nR;
      for (var r = 0; r < nR; r++) {
        var xl = alo + r * dw;
        var xs = cfg.rtype === 'right' ? xl + dw : cfg.rtype === 'mid' ? xl + dw / 2 : xl;
        var hv = f(xs); if (!isFinite(hv)) continue;
        sum += hv * dw;
        g.globalAlpha = 0.55; g.fillStyle = T['plot.area'];
        g.fillRect(X(xl), Y(Math.max(hv, 0)), X(xl + dw) - X(xl), Math.abs(Y(hv) - Y(0)));
        g.globalAlpha = 1; g.strokeStyle = T['plot.curve2']; g.lineWidth = 1;
        g.strokeRect(X(xl), Y(Math.max(hv, 0)), X(xl + dw) - X(xl), Math.abs(Y(hv) - Y(0)));
      }
    } else if (cfg.area) {
      g.beginPath(); g.moveTo(X(cfg.area[0]), Y(0));
      for (var q = 0; q <= 200; q++) { var ax = cfg.area[0] + (cfg.area[1] - cfg.area[0]) * q / 200; g.lineTo(X(ax), Y(f(ax))); }
      g.lineTo(X(cfg.area[1]), Y(0)); g.closePath();
      g.globalAlpha = 0.6; g.fillStyle = T['plot.area']; g.fill(); g.globalAlpha = 1;
    }

    // axes
    g.strokeStyle = T['plot.axis']; g.lineWidth = 2;
    var yAxis = (0 >= y0 && 0 <= y1) ? Y(0) : M.t + ph;
    var xAxis = (0 >= x0 && 0 <= x1) ? X(0) : M.l;
    g.beginPath(); g.moveTo(M.l, yAxis); g.lineTo(M.l + pw, yAxis); g.stroke();
    g.beginPath(); g.moveTo(xAxis, M.t); g.lineTo(xAxis, M.t + ph); g.stroke();
    g.fillStyle = T['plot.text']; g.textAlign = 'center'; g.textBaseline = 'top';
    for (var ix = Math.ceil(x0 / sx - 1e-9), tx = ix * sx; tx <= x1 + 1e-9; ix++, tx = ix * sx) {
      if (Math.abs(tx) < 1e-9) continue;
      g.beginPath(); g.moveTo(X(tx), yAxis - 5); g.lineTo(X(tx), yAxis + 5); g.strokeStyle = T['plot.axis']; g.stroke();
      g.fillText(cfg.xticksPi ? piLabel(tx) : fmtTick(tx, sx), X(tx), yAxis + 10);
    }
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (var iy = Math.ceil(y0 / sy - 1e-9), ty = iy * sy; ty <= y1 + 1e-9; iy++, ty = iy * sy) {
      if (Math.abs(ty) < 1e-9) continue;
      g.beginPath(); g.moveTo(xAxis - 5, Y(ty)); g.lineTo(xAxis + 5, Y(ty)); g.strokeStyle = T['plot.axis']; g.stroke();
      g.fillText(cfg.yticksPi ? piLabel(ty) : fmtTick(ty, sy), xAxis - 12, Y(ty));
    }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = T['plot.text']; g.font = 'italic ' + pxk(22, cfg.k) + 'px ' + FT.replace(/'/g, '"');
    g.fillText(cfg.xlabel, M.l + pw - 4, yAxis - 14);
    g.fillText(cfg.ylabel, xAxis + 12, M.t + 4);

    // curves
    function curve(fn, color, width, dash) {
      g.save(); g.beginPath(); g.setLineDash(dash || []); g.lineCap = 'round'; g.strokeStyle = color; g.lineWidth = width;
      g.rect(M.l, M.t, pw, ph); g.clip(); g.beginPath();
      var started = false;
      for (var s = 0; s <= 900; s++) {
        var xv = x0 + (x1 - x0) * s / 900, yv = fn(xv);
        if (!isFinite(yv)) { started = false; continue; }
        if (!started) { g.moveTo(X(xv), Y(yv)); started = true; } else g.lineTo(X(xv), Y(yv));
      }
      g.stroke(); g.restore();
    }
    if (f2) curve(f2, S.f2.color, S.f2.width, S.f2.dash);
    curve(f, S.f.color, S.f.width, S.f.dash);

    function dot(x, y, color, r) {
      g.beginPath(); g.arc(X(x), Y(y), r || 9, 0, 6.284);
      g.fillStyle = color; g.fill(); g.strokeStyle = T.background; g.lineWidth = 3; g.stroke();
    }
    function line(px, py, slope, color, width, dash) {
      g.save(); g.beginPath(); g.rect(M.l, M.t, pw, ph); g.clip();
      g.setLineDash(dash || []); g.lineCap = 'round'; g.strokeStyle = color; g.lineWidth = width;
      g.beginPath(); g.moveTo(X(x0), Y(py + slope * (x0 - px))); g.lineTo(X(x1), Y(py + slope * (x1 - px))); g.stroke();
      g.restore();
    }

    var a = cfg.a, fa = f(a), mSec = NaN, mTan = NaN;
    if (cfg.tangent) {
      var eh = 1e-5; mTan = (f(a + eh) - f(a - eh)) / (2 * eh);
      line(a, fa, mTan, S.tangent.color, S.tangent.width, S.tangent.dash);
    }
    if (cfg.secant) {
      var fb = f(a + h); mSec = (fb - fa) / h;
      line(a, fa, mSec, S.secant.color, S.secant.width, S.secant.dash);
      // h bracket
      g.strokeStyle = S.secant.color; g.lineWidth = 2; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(X(a + h), Y(fb)); g.lineTo(X(a + h), Y(fa)); g.lineTo(X(a), Y(fa)); g.stroke();
      g.setLineDash([]);
      dot(a + h, fb, S.secant.color);
    }
    if (cfg.secant || cfg.tangent || cfg.points) dot(a, fa, T['plot.point']);
    // open circles where a curve has a hole, at the limit of its values from both sides
    function hole(fn, list, color) {
      String(list || '').split(/[;,]/).forEach(function (p) {
        var x = numExpr(p, NaN);
        if (!isFinite(x)) return;
        var y = fn(x);
        if (!isFinite(y)) { var e = (x1 - x0) * 1e-6; y = (fn(x - e) + fn(x + e)) / 2; }
        if (!isFinite(y)) return;
        g.beginPath(); g.arc(X(x), Y(y), 9, 0, 6.284);
        g.fillStyle = T.background; g.fill(); g.strokeStyle = color; g.lineWidth = 3; g.setLineDash([]); g.stroke();
      });
    }
    hole(f, cfg.holes, S.f.color);
    if (f2) hole(f2, cfg.holes2, S.f2.color);
    (cfg.points || '').split(/[;,]/).forEach(function (p) {
      var v = numExpr(p, NaN); if (isFinite(v)) dot(v, f(v), T['plot.point'], 7);
    });

    if (cfg.readout) {
      g.font = pxk(24, cfg.k) + 'px ' + FM.replace(/'/g, '"');
      g.textAlign = 'left'; g.textBaseline = 'top';
      var parts = [];
      if (cfg.secant) parts.push(['h = ' + fmt(h), S.secant.color], ['m_sec = ' + fmt(mSec), S.secant.color]);
      if (cfg.tangent) parts.push(["f'(" + fmt(a) + ') = ' + fmt(mTan), S.tangent.color]);
      if (nR) parts.push(['n = ' + nR, T['plot.curve2']], ['sum = ' + fmt(sum), T['plot.curve2']]);
      if (cfg.animate && cfg.animate.key === 'zoom') parts.push(['window = ' + fmt(cfg.a - Math.abs(av)) + ' … ' + fmt(cfg.a + Math.abs(av)), T['plot.curve2']]);
      var cx = M.l;
      parts.forEach(function (p) {
        g.fillStyle = p[1]; g.fillText(p[0], cx, 22); cx += g.measureText(p[0]).width + 46;
      });
    }

    // A formula that cannot be read leaves a message on the plot rather than empty axes.
    var bad = [['f', f], ['f2', f2]].filter(function (q) { return q[1] && q[1].error; });
    if (bad.length) {
      var lh = pxk(22, cfg.k) + 8, y = M.t + 14, maxW = pw - 48;
      g.font = pxk(22, cfg.k) + 'px ' + FM.replace(/'/g, '"');
      g.textAlign = 'left'; g.textBaseline = 'top';
      bad.forEach(function (q) {
        var words = (q[0] + ' = ' + (q[0] === 'f' ? cfg.f : cfg.f2) + ' : ' + q[1].error.message).split(' ');
        var lines = [], cur = '';
        words.forEach(function (wd) {
          var trial = cur ? cur + ' ' + wd : wd;
          if (cur && g.measureText(trial).width > maxW) { lines.push(cur); cur = wd; } else cur = trial;
        });
        if (cur) lines.push(cur);
        g.globalAlpha = 0.92; g.fillStyle = T.background;
        g.fillRect(M.l + 8, y - 6, pw - 16, lines.length * lh + 12);
        g.globalAlpha = 1; g.fillStyle = T.alert;
        lines.forEach(function (ln, k) { g.fillText(ln, M.l + 24, y + k * lh); });
        y += lines.length * lh + 18;
      });
    }
    return { X: X, Y: Y, x0: x0, x1: x1, y0: y0, y1: y1, W: W, H: H, f: f, f2: f2 };
  }

  /* ---------- mounting ---------- */
  function mountSlide(container, slide, meta, opts) {
    opts = opts || {};
    ensureEngineCSS();
    container.innerHTML = slideHTML(slide, meta || {});
    var step = 0, rafs = [], plots = [], jsFigs = [];

    // A subtle presenter cue: when visible, the next advance leaves this slide.
    // Keeping it inside mountSlide makes it automatically respect every source of
    // overlay steps (\pause, \uncover, plot frames, and JavaScript figure frames).
    var advanceCue = document.createElement('div');
    advanceCue.className = 'lec-cue';
    advanceCue.setAttribute('data-advance-cue', '1');
    advanceCue.setAttribute('aria-hidden', 'true');
    advanceCue.textContent = '›';
    container.appendChild(advanceCue);
    var slideK = SC * ((slide.opts && slide.opts.scale) || 1);
    var palette = figureColors(meta && meta.themeColors);

    // plots
    Array.prototype.forEach.call(container.querySelectorAll('[data-plot]'), function (fig) {
      var cfg = JSON.parse(fig.getAttribute('data-plot'));
      var labels = Array.prototype.slice.call(fig.querySelectorAll('.lec-plot-label'));
      cfg.k = slideK;
      cfg.themeColors = (meta && meta.themeColors) || DEFAULT_THEME;
      var canvas = fig.querySelector('canvas');
      var state = { cur: null, target: null, raf: 0 };
      function valueFor(st) {
        if (!cfg.animate) return cfg.hval;
        var k = clamp(st - cfg.from, 0, cfg.frames - 1), a = cfg.animate.from, b = cfg.animate.to;
        var u = cfg.frames === 1 ? 1 : k / (cfg.frames - 1);
        if (a > 0 && b > 0) return a * Math.pow(b / a, u);
        return a + (b - a) * u;
      }
      // Curve labels sit just above their curve, near the right end or at the x they name.
      function place(geo) {
        labels.forEach(function (el) {
          var which = el.getAttribute('data-curve'), fn = which === 'f2' ? geo.f2 : geo.f;
          var spec = which === 'f2' ? cfg.label2 : cfg.label, sty = which === 'f2' ? cfg.style2 : cfg.style;
          el.style.color = plotStyle(sty, cfg.themeColors, cfg.themeColors[which === 'f2' ? 'plot.curve2' : 'plot.curve'], 1, 'solid').color;
          var x = spec.at, y = NaN, span = geo.x1 - geo.x0, pad = (geo.y1 - geo.y0) * 0.04;
          var inside = function (t) { var v = fn(t); return isFinite(v) && v >= geo.y0 + pad && v <= geo.y1 - pad; };
          if (x === null || x === undefined || !isFinite(x)) {
            for (var k = 0; k <= 60; k++) { var t = geo.x1 - span * (0.03 + 0.9 * k / 60); if (inside(t)) { x = t; break; } }
            el.style.transform = 'translate(-100%, -115%)';
          } else el.style.transform = 'translate(-50%, -120%)';
          if (x !== null && x !== undefined && isFinite(x)) y = fn(x);
          if (!isFinite(y)) { el.style.display = 'none'; return; }
          el.style.display = '';
          el.style.left = (geo.X(x) / geo.W * 100) + '%';
          el.style.top = (geo.Y(y) / geo.H * 100) + '%';
        });
      }
      function tween(to) {
        state.target = to;
        if (state.cur === null) { state.cur = to; place(drawPlot(canvas, cfg, to)); return; }
        var from = state.cur, t0 = performance.now(), dur = 520;
        cancelAnimationFrame(state.raf);
        (function loop(now) {
          var u = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - u, 3);
          state.cur = from + (to - from) * e;
          place(drawPlot(canvas, cfg, state.cur));
          if (u < 1) state.raf = requestAnimationFrame(loop);
        })(t0);
        rafs.push(function () { cancelAnimationFrame(state.raf); });
      }
      plots.push({ set: function (st) { tween(valueFor(st)); } });
      tween(valueFor(0));
    });

    // js figures: the code runs only while the figure is inside its interval, and again
    // only when its frame changes. local counts frames from the start of the interval.
    Array.prototype.forEach.call(container.querySelectorAll('[data-js]'), function (fig) {
      var canvas = fig.querySelector('canvas');
      var code = (fig.querySelector('script') || {}).textContent || '';
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = +canvas.getAttribute('data-w'), hh = +canvas.getAttribute('data-h');
      var from = +fig.getAttribute('data-js-from'), toA = fig.getAttribute('data-js-to');
      var to = toA === null || toA === 'Infinity' ? Infinity : +toA;
      var frames = Math.max(1, +fig.getAttribute('data-frames') || 1);
      canvas.width = w * dpr; canvas.height = hh * dpr;
      var ctx = canvas.getContext('2d');
      var live = [], shown = null, state = {};
      var body = null, compileErr = null;
      try {
        body = new Function('canvas', 'ctx', 'w', 'h', 'step', 'onFrame', 'colors', 'plot', 'local', 'frames', 'state', code);
      } catch (err) { compileErr = err; }
      function stop() { live.forEach(function (id) { cancelAnimationFrame(id); }); live.length = 0; }
      function run(st) {
        var on = st >= from && st <= to;
        if (!on) {
          if (shown !== null) { stop(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, hh); }
          shown = null;
          return;
        }
        var local = clamp(st - from, 0, frames - 1);
        if (local === shown) return;
        shown = local;
        stop();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, hh);
        function onFrame(cb) {
          var t0 = performance.now();
          (function loop(now) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            cb((now - t0) / 1000);
            live.push(requestAnimationFrame(loop));
          })(t0);
        }
        try {
          if (compileErr) throw compileErr;
          body(canvas, ctx, w, hh, st, onFrame, palette, { compile: compile, draw: drawPlot }, local, frames, state);
        } catch (err) {
          ctx.fillStyle = C.red2; ctx.font = '22px monospace';
          ctx.fillText('js block error: ' + err.message, 20, 40);
        }
      }
      jsFigs.push({ set: run });
      rafs.push(stop);
    });

    // Timers start when they become visible, reset when hidden again, and pause or restart
    // on click or the t key. They count real time, so they keep going with reduced motion.
    var timers = Array.prototype.map.call(container.querySelectorAll('[data-timer]'), function (btn) {
      var total = +btn.getAttribute('data-timer'), wrap = btn.parentNode;
      var digits = btn.querySelector('.lec-timer-digits'), fill = btn.querySelector('.lec-timer-fill');
      var live = wrap.querySelector('.lec-sr');
      var tm = { state: 'idle', left: total, t0: 0, raf: 0, shown: '' };
      function paint() {
        var txt = clock(tm.left);
        if (txt !== tm.shown) { digits.textContent = txt; tm.shown = txt; }
        fill.style.width = (100 * Math.max(0, tm.left) / total) + '%';
        btn.classList.toggle('lec-timer--warn', tm.left <= 30 && tm.left > 10);
        btn.classList.toggle('lec-timer--end', tm.left <= 10);
        btn.classList.toggle('lec-timer--paused', tm.state === 'paused');
      }
      function tick(now) {
        tm.left = tm.base - (now - tm.t0) / 1000;
        if (tm.left <= 0) { tm.left = 0; tm.state = 'done'; paint(); live.textContent = 'Time is up.'; return; }
        paint();
        tm.raf = requestAnimationFrame(tick);
      }
      function run() { tm.state = 'running'; tm.base = tm.left; tm.t0 = performance.now(); live.textContent = ''; tm.raf = requestAnimationFrame(tick); }
      function stop() { cancelAnimationFrame(tm.raf); }
      function reset() { stop(); tm.state = 'idle'; tm.left = total; live.textContent = ''; paint(); }
      tm.toggle = function () {
        if (tm.state === 'running') { stop(); tm.state = 'paused'; paint(); }
        else if (tm.state === 'done') { tm.left = total; run(); }
        else run();
      };
      tm.set = function (visible) {
        if (!visible) { if (tm.state !== 'idle') reset(); return; }
        if (tm.state === 'idle') run();
      };
      tm.wrap = wrap; tm.stop = stop;
      btn.addEventListener('click', function (e) { e.stopPropagation(); tm.toggle(); });
      rafs.push(stop);
      paint();
      return tm;
    });

    // image slots
    Array.prototype.forEach.call(container.querySelectorAll('[data-imageslot]'), function (fig) {
      var id = fig.getAttribute('data-imageslot');
      var drop = fig.querySelector('[data-drop]');
      var baked = (window.LECTURE_IMAGES || {})[id];
      var stored = baked;
      if (!stored) { try { stored = localStorage.getItem('lec2-img:' + id); } catch (e) { } }
      function show(src) {
        drop.innerHTML = '<img src="' + src + '" alt="' + escAttr(fig.getAttribute('data-alt') || '') + '" style="width:100%;height:100%;object-fit:contain;display:block">';
        drop.style.border = '1px solid ' + C.mist;
        drop.style.background = '#fff';
      }
      if (stored) show(stored);
      if (opts.readonly) return;
      drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.style.borderColor = C.orange; });
      drop.addEventListener('dragleave', function () { drop.style.borderColor = C.pale; });
      drop.addEventListener('drop', function (e) {
        e.preventDefault(); drop.style.borderColor = C.pale;
        var file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (!file) return;
        var fr = new FileReader();
        fr.onload = function () {
          show(fr.result);
          try { localStorage.setItem('lec2-img:' + id, fr.result); } catch (err) { }
        };
        fr.readAsDataURL(file);
      });
    });

    // Hidden content keeps its space and is hidden from screen readers; \only content
    // leaves the layout. Visibility is cleared (not set to visible) when shown, so a
    // hidden parent still hides everything inside it.
    var gated = Array.prototype.slice.call(container.querySelectorAll('[data-from]'));
    function isOn(el, s) {
      var f = +el.getAttribute('data-from');
      var toA = el.getAttribute('data-to');
      var to = toA === null || toA === 'Infinity' ? Infinity : +toA;
      return s >= f && s <= to;
    }
    function applyOnly(s) {
      gated.forEach(function (el) {
        if (el.getAttribute('data-hide') === 'none') el.style.display = isOn(el, s) ? '' : 'none';
      });
    }
    function setStep(st) {
      step = clamp(st, 0, slide.steps);
      gated.forEach(function (el) {
        var on = isOn(el, step);
        if (el.getAttribute('data-hide') === 'none') { el.style.display = on ? '' : 'none'; return; }
        el.style.transition = 'opacity .3s ease';
        el.style.opacity = on ? '1' : '0';
        el.style.visibility = on ? '' : 'hidden';
        if (on) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
      });
      plots.forEach(function (p) { p.set(step); });
      jsFigs.forEach(function (j) { j.set(step); });
      timers.forEach(function (tm) {
        var on = true;
        for (var el = tm.wrap; el && el !== container; el = el.parentNode) {
          if (el.hasAttribute && el.hasAttribute('data-from') && !isOn(el, step)) { on = false; break; }
        }
        tm.set(on);
      });
      advanceCue.style.opacity = step >= slide.steps ? '.52' : '0';
    }
    setStep(0);

    var flow = container.querySelector('[data-flow]');
    if (flow) {
      var fitFlow = function () {
        if (!flow.isConnected) return;
        // undo any earlier fit so the measurement starts from the natural layout
        flow.style.transform = ''; flow.style.width = ''; flow.style.height = '';
        flow.style.flex = '1 1 auto'; flow.style.overflowY = ''; flow.scrollTop = 0;
        var oldFade = flow.parentNode && flow.parentNode.querySelector('[data-fade]');
        if (oldFade) oldFade.remove();
        // Size the slide once, for its tallest step. Only \only content changes the layout.
        var tall = flow.scrollHeight;
        if (gated.some(function (el) { return el.getAttribute('data-hide') === 'none'; })) {
          for (var s = 0; s <= slide.steps; s++) { applyOnly(s); tall = Math.max(tall, flow.scrollHeight); }
          applyOnly(step);
        }
        var over = tall - flow.clientHeight;
        var k = 1;
        if (over > 26) { // ignore the trailing block margin
          k = flow.clientHeight / tall;
          if (k < 0.85) {
            // past 15% overflow, stop shrinking and let this slide scroll instead of losing content
            k = 0.85;
            var box = flow.clientHeight;
            flow.style.overflowY = 'auto';
            flow.style.scrollbarWidth = 'thin';
            // the scale shrinks the painted box, so grow the layout box to fill the slide again
            flow.style.flex = '0 0 auto';
            flow.style.height = Math.round(box / k) + 'px';
            var host = flow.parentNode;
            if (host && !host.querySelector('[data-fade]')) {
              host.style.position = 'relative';
              var fade = document.createElement('div');
              fade.setAttribute('data-fade', '1');
              fade.style.cssText = 'position:absolute;left:0;right:0;top:' +
                Math.round(flow.offsetTop + box - 56) + 'px;height:56px;pointer-events:none;' +
                'opacity:0;transition:opacity .18s ease;' +
                'background:linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.92))';
              host.appendChild(fade);
              var sync = function () {
                var left = flow.scrollHeight - flow.clientHeight - flow.scrollTop;
                fade.style.opacity = left > 4 ? '1' : '0';
              };
              if (flow._lecSync) flow.removeEventListener('scroll', flow._lecSync);
              flow._lecSync = sync;
              flow.addEventListener('scroll', sync);
              requestAnimationFrame(sync);
            }
          }
          flow.style.transform = 'scale(' + k + ')';
          flow.style.width = (100 / k) + '%';
        }
        if (opts.onFit) opts.onFit(k);
      };
      requestAnimationFrame(function () {
        fitFlow();
        // web fonts (Spectral, JetBrains Mono, and each KaTeX face on first use) may still be
        // loading at this moment; measure again once they arrive so the fit uses real metrics
        if (document.fonts && document.fonts.status !== 'loaded') {
          document.fonts.ready.then(function () { requestAnimationFrame(fitFlow); });
        }
      });
    }

    return {
      setStep: setStep,
      // pause or restart the timers that are showing
      toggleTimers: function () {
        var any = false;
        timers.forEach(function (tm) { if (tm.state !== 'idle') { tm.toggle(); any = true; } });
        return any;
      },
      destroy: function () { rafs.forEach(function (f) { f(); }); container.innerHTML = ''; }
    };
  }

  /* ---------- player: one slide at a time, with its tray and progress bar ----------
     Used by the editor and by every published file, so the two always behave the same. */
  function player(root, opts) {
    opts = opts || {};
    ensureEngineCSS();
    root.classList.add('lec-player');
    root.innerHTML =
      '<div class="lec-stage-slide" role="region" aria-roledescription="slide"></div>' +
      '<div class="lec-tray">' +
      '<button type="button" class="lec-nav" data-act="prev" aria-label="Previous" title="Previous (\u2190)">\u2190</button>' +
      '<button type="button" class="lec-nav" data-act="next" aria-label="Next" title="Next (\u2192 or space)">\u2192</button>' +
      '<div class="lec-footer"></div><div class="lec-copy"></div><div class="lec-counter"></div></div>' +
      '<div class="lec-bar"></div><div class="lec-track" title="Drag to scrub through the deck"></div>' +
      '<div class="lec-sr" aria-live="polite"></div>';
    var slideEl = root.querySelector('.lec-stage-slide'), tray = root.querySelector('.lec-tray');
    var bar = root.querySelector('.lec-bar'), track = root.querySelector('.lec-track'), sr = root.querySelector('.lec-sr');
    var footer = root.querySelector('.lec-footer'), copy = root.querySelector('.lec-copy'), counter = root.querySelector('.lec-counter');
    var navs = root.querySelectorAll('.lec-nav');
    navs[0].onclick = function () { go(-1); };
    navs[1].onclick = function () { go(1); };
    (opts.extraButtons || []).forEach(function (bt) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'lec-extra';
      b.innerHTML = bt.html; b.title = bt.title || '';
      if (bt.label) b.setAttribute('aria-label', bt.label);
      b.onclick = bt.onClick;
      tray.appendChild(b);
      bt.el = b;
    });

    var slides = [], meta = {}, si = 0, step = 0, ctrl = null;
    function settings() {
      [].forEach.call(navs, function (n) { n.style.opacity = opts.arrowOpacity == null ? 0.6 : opts.arrowOpacity; });
    }
    function chrome() {
      var slide = slides[si] || {}, n = slides.length || 1;
      var mode = String(meta.footer || 'section').toLowerCase();
      var label = mode === 'none' ? '' : mode === 'slide' ? (slide.title || meta.title) : mode === 'deck' ? meta.title
        : (slide.section || meta.title);
      footer.innerHTML = inline(label || '');
      copy.textContent = meta.copyright || opts.copyright || '';
      counter.textContent = (si + 1) + ' / ' + n;
      counter.style.display = /^(off|no|false|0)$/i.test(meta.slidenumbers || '') ? 'none' : '';
      var showBar = !/^(off|no|false|0)$/i.test(meta.progressbar || '');
      bar.style.display = showBar ? '' : 'none';
      bar.style.width = ((si + 1) / n * 100) + '%';
      slideEl.setAttribute('aria-label', 'Slide ' + (si + 1) + ' of ' + n);
    }
    function announce() {
      var slide = slides[si] || {};
      var title = slide.kind === 'title' ? meta.title : slide.title;
      sr.textContent = 'Slide ' + (si + 1) + ' of ' + slides.length + (title ? ': ' + plainText(title) : '');
    }
    function changed() { if (opts.onChange) opts.onChange(si, step); }
    function mount() {
      if (!slides.length) return;
      if (ctrl) ctrl.destroy();
      // the theme's colors, for the tray and everything drawn by the player
      ROLES.forEach(function (r) { root.style.removeProperty(roleVar(r.name)); });
      var tc = meta.themeColors || DEFAULT_THEME;
      ROLES.forEach(function (r) { if (tc[r.name] && tc[r.name] !== r.color) root.style.setProperty(roleVar(r.name), tc[r.name]); });
      ctrl = mountSlide(slideEl, slides[si], meta, { readonly: opts.readonly, onFit: opts.onFit });
      ctrl.setStep(step);
      chrome(); announce(); changed();
    }
    function go(d) {
      var slide = slides[si];
      if (!slide) return;
      if (d > 0) {
        if (step < slide.steps) { step++; ctrl.setStep(step); changed(); }
        else if (si < slides.length - 1) { si++; step = 0; mount(); }
      } else {
        if (step > 0) { step--; ctrl.setStep(step); changed(); }
        else if (si > 0) { si--; step = slides[si].steps; mount(); }
      }
    }
    function jump(i) {
      if (!slides.length) return;
      var k = clamp(i, 0, slides.length - 1);
      if (k === si) return;
      si = k; step = 0; mount();
    }

    track.addEventListener('pointerdown', function (e) {
      function pick(cx) {
        var r = track.getBoundingClientRect();
        if (!r.width) return;
        jump(Math.floor(clamp((cx - r.left) / r.width, 0, 0.9999) * slides.length));
      }
      function move(ev) { ev.preventDefault(); pick(ev.clientX); }
      function up() {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        bar.style.height = ''; bar.style.transition = '';
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      bar.style.height = '10px'; bar.style.transition = 'none';
      pick(e.clientX);
    });

    function onKey(e) {
      if (opts.keysEnabled && !opts.keysEnabled()) return;
      var t = e.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      // a focused button already acts on Space and Enter
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') { e.preventDefault(); jump(0); }
      else if (e.key === 'End') { e.preventDefault(); jump(slides.length - 1); }
      else if (e.key === 't') { if (ctrl && ctrl.toggleTimers()) e.preventDefault(); }
      else if (e.key === 'f') {
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
      }
    }
    if (opts.keys !== false) window.addEventListener('keydown', onKey);
    settings();

    return {
      // Show a parsed deck, keeping the position when possible.
      setDeck: function (parsed, atSlide, atStep) {
        slides = parsed.slides; meta = parsed.meta;
        si = clamp(atSlide == null ? si : atSlide, 0, slides.length - 1);
        step = clamp(atStep || 0, 0, slides[si].steps);
        mount();
      },
      go: go, jump: jump, remount: mount,
      setOptions: function (o) { for (var k in o) opts[k] = o[k]; settings(); chrome(); },
      get si() { return si; }, get step() { return step; },
      destroy: function () {
        window.removeEventListener('keydown', onKey);
        if (ctrl) ctrl.destroy();
        root.innerHTML = '';
      }
    };
  }

  /* ---------- published standalone build ---------- */
  function scriptSafe(js) { return String(js).replace(/<\/(script)/gi, '<\\/$1'); }
  function STANDALONE(title, source, imgs, scale, themes) {
    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<meta name="generator" content="lecture-engine ' + VERSION + '">' +
      '<title>' + esc(plainText(title) || 'Lecture') + '</title>' +
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">' +
      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>' +
      '<style>html,body{margin:0;height:100%;background:#fff;overflow:hidden}' +
      '#wrap{position:fixed;inset:0;overflow:hidden}' +
      '#stage{position:absolute;top:0;left:0;width:1920px;height:1080px;transform-origin:top left}</style></head>' +
      '<body><main id="wrap"><div id="stage"></div></main>' +
      '<script>window.LECTURE_IMAGES=' + scriptSafe(JSON.stringify(imgs)) + ';window.LECTURE_SOURCE=' +
      scriptSafe(JSON.stringify(source)) + ';window.LECTURE_SCALE=' + scale + ';window.LECTURE_THEMES=' +
      scriptSafe(JSON.stringify(themes || {})) + ';<\/script>' +
      '<script>' + scriptSafe(ENGINE_SOURCE) + '<\/script>' +
      '<script>(' + scriptSafe(PLAYER.toString()) + ')();<\/script></body></html>';
  }
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
    window.Lecture.player(stage, { readonly: true }).setDeck(window.Lecture.parse(window.LECTURE_SOURCE), 0, 0);
  }

  // A theme that comes from a themes/ file is copied in, so the published file stands alone.
  function publishedThemes(parsed) {
    var used = {}, reg = (typeof window !== 'undefined' && window.LECTURE_THEMES) || {};
    (parsed.theme.chain || []).forEach(function (n) { if (!parsed.themes[n] && reg[n]) used[n] = reg[n]; });
    return used;
  }
  function publish(source, opts) {
    opts = opts || {};
    var parsed = parse(source);
    var imgs = {};
    parsed.slides.forEach(function (s) {
      (function walk(bs) {
        bs.forEach(function (b) {
          if (b.type === 'image') { try { var v = localStorage.getItem('lec2-img:' + b.id); if (v) imgs[b.id] = v; } catch (e) { } }
          if (b.blocks) walk(b.blocks);
          if (b.cols) b.cols.forEach(walk);
        });
      })(s.blocks);
    });
    var html = STANDALONE(parsed.meta.title, source, imgs, SC, publishedThemes(parsed));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = (plainText(parsed.meta.title) || 'lecture').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    if (opts.done) opts.done(true);
    return html;
  }

  var STARTER = "% Lines beginning with % are comments and never appear on a slide.\n\\engine{2}\n\\title{Lecture N — Topic}\n\\course{MATH 1131Q — Calculus I}\n\\author{Matthew Badger}\n\\date{Month D, YYYY}\n\\copyright{(C) Matthew Badger 2026}\n\n\\titleslide\n\n\\section{First idea}\n\n\\slide{A slide with steps}\nOne sentence of setup, with inline math $f(x)=x^2$ in it.\n\\pause\n\\begin{itemize}\n\\item First point\n\\pause\n\\item Second point, with \\alert{emphasis}\n\\end{itemize}\n\n\\slide{A derivation}\n\\begin{align}\n\\frac{f(a+h)-f(a)}{h} &= \\text{something} \\\\[2pt]\n\\pause\n&= \\text{something simpler}\n\\end{align}\n\\pause\n\\begin{definition}{Name}\nState the definition here.\n\\end{definition}\n\n\\slide{A plot that animates on \\pause}\n\\begin{plot}\nf = x^2\ndomain = -0.5:3\na = 1\nsecant = true\ntangent = true\nsize = 1000x460\nframes = 6\nanimate = h: 1.6 -> 0.05\ncaption = caption text\n\\end{plot}\n\n\\slide{Two columns and a drop slot}\n\\begin{columns}[1 1]\nText on the left.\n\\columnbreak\n\\imageslot{fig-1}{Drop a figure here}\n\\end{columns}\n\n\\slide{You Try}\n\\begin{youtry}[60]\nState a short problem here.\n\\end{youtry}\n";

  window.Lecture = {
    starter: STARTER,
    setScale: function (k) { SC = Math.max(0.8, Math.min(1.6, +k || 1)); return SC; },
    getScale: function () { return SC; },
    parse: parse, mountSlide: mountSlide, slideHTML: slideHTML, player: player, standalone: STANDALONE,
    publish: publish, colors: C, fonts: { text: FT, mono: FM }, compile: compile,
    compileExpr: compileExpr, version: VERSION, piLabel: piLabel,
    // for the editor's Theme dialog
    themes: {
      roles: ROLES, defaults: DEFAULT_THEME, pairs: contrastPairs(), resolve: resolveTheme, blocks: themeBlocks,
      blockText: blockText, contrast: contrastRatio, color: colorValue, style: themeStyle, forPublish: publishedThemes,
      available: function (source) {
        var out = [{ name: 'default', from: 'built in' }, { name: 'contrast', from: 'built in' }];
        Object.keys(fileThemes()).forEach(function (n) { out.push({ name: n, from: 'theme file' }); });
        Object.keys(themeBlocks(source)).forEach(function (n) { out.push({ name: n, from: 'this lecture' }); });
        return out;
      },
      fileText: function (name, block) {
        return '(window.LECTURE_THEMES = window.LECTURE_THEMES || {})[' + JSON.stringify(name) + '] = String.raw`' + block + '`;\n';
      },
      suggestions: {
        text: ['#111111', '#000000', '#125A56', '#003D3A', '#00767B', '#2A55B8', '#1E3F8A', '#8E3A8A', '#00765A', '#B24A00', '#D11807', '#A00000', '#A01813', '#555555'],
        line: ['#125A56', '#238F9D', '#00767B', '#2A55B8', '#8E3A8A', '#00765A', '#B24A00', '#D11807', '#A01813', '#222222', '#555555'],
        edge: ['#125A56', '#238F9D', '#42A7C6', '#F57634', '#A01813', '#555555', '#2A55B8', '#8E3A8A', '#00765A', '#B24A00'],
        fill: ['#FFFFFF', '#FAFAFA', '#DEE6E7', '#EEF2F2', '#ECEADA', '#F7F6EE', '#EAF4FB', '#F2F8FC', '#F4EEF6', '#EEF6F1', '#FBF1E8', '#C6DBED', '#E8EFEF']
      }
    }
  };
})();
