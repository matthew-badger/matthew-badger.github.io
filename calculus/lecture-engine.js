/* Lecture engine — LaTeX-ish source -> slides, overlays, animated plots.
   Shared by the authoring deck (Lecture.dc.html) and any published deck. */
(function () {
  'use strict';
  var ENGINE_URL = (document.currentScript && document.currentScript.src) || 'lecture-engine.js';

  var C = {
    teal: '#125A56', teal2: '#00767B', teal3: '#238F9D', blue: '#42A7C6', blue2: '#60BCE9',
    blue3: '#9DCCEF', pale: '#C6DBED', mist: '#DEE6E7', cream: '#ECEADA', sand: '#F0E6B2',
    gold: '#F9D576', amber: '#FFB954', orange: '#FD9A44', burnt: '#F57634',
    red: '#E94C1F', red2: '#D11807', maroon: '#A01813'
  };
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

  /* ---------- expression compiler ---------- */
  var FUNCS = ['asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sin', 'cos', 'tan',
    'exp', 'sqrt', 'abs', 'log10', 'log2', 'floor', 'ceil', 'round', 'sign', 'min', 'max', 'pow', 'cbrt'];
  function compile(expr) {
    var e = String(expr == null ? '0' : expr);
    e = e.replace(/\\left|\\right|\\!|\\,|\\;/g, '');
    e = e.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))');
    e = e.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');
    e = e.replace(/\\?\bln\b/g, 'LOGE').replace(/\\?\blog\b(?!10|2)/g, 'LOGE');
    e = e.replace(/\\/g, '');
    var toks = [];
    FUNCS.forEach(function (f) {
      e = e.replace(new RegExp('\\b' + f + '\\b', 'g'), function () {
        toks.push('Math.' + f); return '@' + (toks.length - 1) + '@';
      });
    });
    e = e.replace(/\bLOGE\b/g, function () { toks.push('Math.log'); return '@' + (toks.length - 1) + '@'; });
    e = e.replace(/\bpi\b/g, '(Math.PI)').replace(/\be\b/g, '(Math.E)');
    e = e.replace(/\^/g, '**');
    e = e.replace(/(\d(?:\.\d+)?)\s*(?=[x(@])/g, '$1*');
    e = e.replace(/(\))\s*(?=[x(@])/g, ')*');
    e = e.replace(/@(\d+)@/g, function (m, i) { return toks[+i]; });
    try {
      /* eslint-disable no-new-func */
      var fn = new Function('x', 'var t=x,n=x;return (' + e + ');');
      fn(1);
      return fn;
    } catch (err) {
      return function () { return NaN; };
    }
  }

  /* ---------- KaTeX ---------- */
  function tex(s, display) {
    if (!window.katex) return '<code style="font-family:' + FM + '">' + esc(s) + '</code>';
    try {
      var src = String(s).replace(/\\alert\{/g, '\\textcolor{#E94C1F}{').replace(/\\accent\{/g, '\\textcolor{#00767B}{');
      return window.katex.renderToString(src, {
        displayMode: !!display, throwOnError: false, strict: false,
        macros: { '\\R': '\\mathbb{R}', '\\dd': '\\mathrm{d}', '\\eps': '\\varepsilon' }
      });
    } catch (err) {
      return '<span style="color:' + C.red2 + ';font-family:' + FM + '">' + esc(s) + '</span>';
    }
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
        var m = /^\\(only|uncover|visible|alert|textbf|emph|textit|texttt|accent)(?:<([^>]*)>)?\{/.exec(rest);
        if (m) {
          var open = i + m[0].length - 1;
          var close = matchBrace(s, open);
          if (close < 0) { out += s[i++]; continue; }
          var body = walk(s.slice(open + 1, close));
          var cmd = m[1], r = range(m[2]);
          var tag;
          if (cmd === 'only') tag = keep('<span data-from="' + r.from + '" data-to="' + r.to + '" data-hide="none">');
          else if (cmd === 'uncover' || cmd === 'visible') tag = keep('<span data-from="' + r.from + '" data-to="' + r.to + '">');
          else if (cmd === 'alert') tag = keep('<span style="color:' + C.red + '">');
          else if (cmd === 'accent') tag = keep('<span style="color:' + C.teal2 + '">');
          else if (cmd === 'textbf') tag = keep('<span style="font-weight:600">');
          else if (cmd === 'texttt') tag = keep('<span style="font-family:' + FM + ';font-size:.9em">');
          else tag = keep('<span style="font-style:italic">');
          out += tag + body + keep('</span>');
          i = close + 1;
          continue;
        }
        m = /^\$\$([\s\S]*?)\$\$/.exec(rest) || /^\\\[([\s\S]*?)\\\]/.exec(rest);
        if (m) { out += keep('<span style="display:block;margin:.4em 0;font-size:' + px(42) + '">' + tex(m[1], true) + '</span>'); i += m[0].length; continue; }
        m = /^\$([\s\S]*?)\$/.exec(rest) || /^\\\(([\s\S]*?)\\\)/.exec(rest);
        if (m) { out += keep(tex(m[1], false)); i += m[0].length; continue; }
        if (rest.indexOf('\\\\') === 0) { out += keep('<br>'); i += 2; continue; }
        out += s[i++];
      }
      return out;
    }

    var t = walk(String(src));
    t = esc(t).replace(/\u0001(\d+)\u0001/g, function (m, k) { return stash[+k]; });
    return t.replace(/\n/g, ' ');
  }

  /* ---------- parser ---------- */
  function parse(source) {
    var meta = { title: '', subtitle: '', section: '', date: '', author: '', copyright: '' };
    var lines = String(source || '').replace(/\r/g, '').split('\n');
    var slides = [];
    var section = '';
    var i = 0;

    function newSlide(title, kind) {
      var s = { title: title || '', section: section, kind: kind || 'body', blocks: [], steps: 0 };
      slides.push(s);
      return s;
    }

    var cur = null;
    while (i < lines.length) {
      var t = lines[i].trim(), m;
      if (t === '' || t.charAt(0) === '%') { i++; continue; }
      // Tolerate a missing closing brace so half-typed commands still parse.
      if ((m = t.match(/^\\(title|subtitle|date|author|copyright|course)\{([\s\S]*?)\}?$/))) {
        meta[m[1] === 'course' ? 'subtitle' : m[1]] = m[2]; i++; continue;
      }
      if (t === '\\titleslide') { cur = newSlide('', 'title'); i++; continue; }
      if ((m = t.match(/^\\section(\*?)\{([\s\S]*?)\}?$/))) {
        section = m[2];
        cur = m[1] ? null : newSlide(m[2], 'divider');
        i++; continue;
      }
      if ((m = t.match(/^\\(?:slide|frame|frametitle)\{([\s\S]*?)\}?$/))) { cur = newSlide(m[1]); i++; continue; }
      if (!cur) cur = newSlide('');
      // gather this slide's body lines
      var body = [], startIdx = i;
      while (i < lines.length) {
        var s2 = lines[i].trim();
        if (/^\\(slide|frame|frametitle|section|titleslide)\b/.test(s2)) break;
        if (/^\\(title|subtitle|date|author|copyright|course)\{/.test(s2)) break;
        body.push(lines[i]); i++;
      }
      // Safety net: never leave the outer loop without consuming a line.
      if (i === startIdx) { body.push(lines[i]); i++; }
      var ctx = { step: 0, max: 0 };
      cur.blocks = parseBlocks(body, ctx);
      cur.steps = Math.max(ctx.step, ctx.max);
      cur = null;
    }
    if (!slides.length) slides.push({ title: 'Empty deck', section: '', kind: 'body', blocks: [], steps: 0 });
    return { meta: meta, slides: slides };
  }

  function parseBlocks(lines, ctx) {
    var blocks = [], i = 0;
    while (i < lines.length) {
      var t = lines[i].trim(), m;
      if (t === '' || t.charAt(0) === '%') { i++; continue; }
      if (t === '\\pause') { ctx.step++; i++; continue; }
      if (t === '\\medskip' || t === '\\bigskip' || t === '\\vfill') {
        blocks.push({ type: 'space', size: t === '\\vfill' ? 'fill' : (t === '\\bigskip' ? 44 : 22) }); i++; continue;
      }
      if ((m = t.match(/^\\imageslot\{([^}]*)\}\s*(?:\{([\s\S]*)\})?\s*$/))) {
        blocks.push({ type: 'image', id: m[1], caption: m[2] || '', from: ctx.step }); i++; continue;
      }
      if ((m = t.match(/^\\begin\{(\w+)\}\s*(?:\[([^\]]*)\])?\s*(?:\{([\s\S]*)\})?\s*$/))) {
        var env = m[1], opt = m[2] || '', arg = m[3] || '';
        var inner = [], depth = 1; i++;
        while (i < lines.length) {
          var s2 = lines[i].trim();
          if (s2.indexOf('\\begin{' + env + '}') === 0) depth++;
          if (s2.indexOf('\\end{' + env + '}') === 0) { depth--; if (!depth) break; }
          inner.push(lines[i]); i++;
        }
        i++;
        blocks.push(makeEnv(env, opt, arg, inner, ctx));
        continue;
      }
      var para = [], startIdx = i;
      while (i < lines.length) {
        var s3 = lines[i].trim();
        if (s3 === '' || s3 === '\\pause' || /^\\(begin|imageslot|medskip|bigskip|vfill)\b/.test(s3)) break;
        para.push(lines[i]); i++;
      }
      // Half-typed \begin{ / \imageslot{ etc: consume the line rather than spin.
      if (i === startIdx) { para.push(lines[i]); i++; }
      if (para.length) blocks.push({ type: 'para', text: para.join('\n'), from: ctx.step });
    }
    return blocks;
  }

  function makeEnv(env, opt, arg, lines, ctx) {
    var from = ctx.step;
    if (env === 'itemize' || env === 'enumerate') {
      var items = [], cur = null;
      lines.forEach(function (ln) {
        var t = ln.trim();
        if (t === '\\pause') { ctx.step++; return; }
        var m = t.match(/^\\item\s*(?:<([^>]*)>)?\s*(?:\[([^\]]*)\])?\s*([\s\S]*)$/);
        if (m) {
          cur = {
            text: m[3], marker: m[2] === undefined ? null : m[2],
            from: m[1] ? range(m[1]).from : ctx.step,
            to: m[1] ? range(m[1]).to : Infinity, sub: /^\s{2,}/.test(ln)
          };
          items.push(cur);
        }
        else if (cur) cur.text += '\n' + t;
      });
      return { type: 'list', ordered: env === 'enumerate', items: items, tight: /tight/.test(opt) };
    }
    if (env === 'align' || env === 'align*' || env === 'equation' || env === 'gather') {
      var groups = [], g = [];
      var froms = [ctx.step];
      lines.forEach(function (ln) {
        if (ln.trim() === '\\pause') { groups.push(g.join('\n')); g = []; ctx.step++; froms.push(ctx.step); }
        else g.push(ln);
      });
      groups.push(g.join('\n'));
      return {
        type: 'math', groups: groups.map(function (src, k) { return { src: src, from: froms[k] }; }),
        env: env === 'equation' ? 'equation' : 'aligned'
      };
    }
    if (env === 'theorem' || env === 'definition' || env === 'example' || env === 'note' || env === 'proof') {
      var sub = { step: ctx.step, max: ctx.max };
      var inner = parseBlocks(lines, sub);
      ctx.step = sub.step; ctx.max = Math.max(ctx.max, sub.max);
      return { type: 'box', kind: env, name: arg, blocks: inner, from: from };
    }
    if (env === 'twocol' || env === 'columns') {
      var halves = [[], []], k = 0;
      lines.forEach(function (ln) { if (ln.trim() === '\\columnbreak' || ln.trim() === '\\column') k = 1; else halves[k].push(ln); });
      var c1 = parseBlocks(halves[0], ctx), c2 = parseBlocks(halves[1], ctx);
      return { type: 'cols', a: c1, b: c2, ratio: opt || '1 1' };
    }
    if (env === 'table' || env === 'tabular') {
      var rows = [];
      lines.forEach(function (ln) {
        var t = ln.trim().replace(/\\\\\s*$/, '');
        if (!t || t === '\\hline') return;
        rows.push(t.split('&').map(function (c) { return c.trim(); }));
      });
      return { type: 'table', rows: rows, header: !/noheader/.test(opt), from: from };
    }
    if (env === 'plot') {
      var cfg = plotConfig(lines.join('\n'), opt);
      cfg.from = from;
      if (cfg.animate) ctx.max = Math.max(ctx.max, from + cfg.frames - 1);
      return { type: 'plot', cfg: cfg };
    }
    if (env === 'js') {
      var sz = (opt.match(/size\s*=\s*(\d+)\s*x\s*(\d+)/) || [0, 900, 480]);
      var fr = num((opt.match(/frames\s*=\s*(\d+)/) || [])[1], 0);
      if (fr) ctx.max = Math.max(ctx.max, from + fr - 1);
      return { type: 'js', code: lines.join('\n'), w: +sz[1], h: +sz[2], from: from, caption: (opt.match(/caption\s*=\s*([^,\]]+)/) || [])[1] || '' };
    }
    // unknown env: treat as paragraphs
    var subctx = { step: ctx.step, max: ctx.max };
    var bl = parseBlocks(lines, subctx);
    ctx.step = subctx.step; ctx.max = Math.max(ctx.max, subctx.max);
    return { type: 'group', blocks: bl };
  }

  function plotConfig(body, opt) {
    var cfg = {
      f: 'x^2', f2: '', domain: [-1, 3], range: null, a: 1, hval: 1.5, secant: false, tangent: false,
      riemann: 0, rtype: 'left', area: null, grid: true, w: 980, h: 520, frames: 6,
      animate: null, xlabel: 'x', ylabel: 'y', caption: '', readout: null, points: '',
      curvelabel: ''
    };
    (body + '\n' + opt.replace(/,/g, '\n')).split('\n').forEach(function (ln) {
      var m = ln.trim().match(/^([\w.]+)\s*=\s*([\s\S]*)$/);
      if (!m) return;
      var k = m[1].toLowerCase(), v = m[2].trim();
      switch (k) {
        case 'f': case 'fn': cfg.f = v; break;
        case 'f2': cfg.f2 = v; break;
        case 'domain': cfg.domain = v.split(/[:,]/).map(Number); break;
        case 'range': cfg.range = /auto/i.test(v) ? null : v.split(/[:,]/).map(Number); break;
        case 'a': cfg.a = num(v, 1); break;
        case 'h': cfg.hval = num(v, 1.5); break;
        case 'secant': cfg.secant = bool(v, true); break;
        case 'tangent': cfg.tangent = bool(v, true); break;
        case 'riemann': cfg.riemann = num(v, 0); break;
        case 'rtype': cfg.rtype = v.toLowerCase(); break;
        case 'area': cfg.area = v.split(/[:,]/).map(Number); break;
        case 'grid': cfg.grid = bool(v, true); break;
        case 'size': var s = v.split(/[x,\s]+/); cfg.w = Math.min(1680, num(s[0], 980)); cfg.h = Math.min(760, num(s[1], 520)); break;
        case 'frames': cfg.frames = Math.max(2, num(v, 6)); break;
        case 'xlabel': cfg.xlabel = v; break;
        case 'ylabel': cfg.ylabel = v; break;
        case 'caption': cfg.caption = v; break;
        case 'label': cfg.curvelabel = v; break;
        case 'points': cfg.points = v; break;
        case 'readout': cfg.readout = bool(v, true); break;
        case 'animate':
          var am = v.match(/^(\w+)\s*:\s*(-?[\d.]+)\s*(?:->|to)\s*(-?[\d.]+)$/);
          if (am) cfg.animate = { key: am[1].toLowerCase(), from: +am[2], to: +am[3] };
          break;
      }
    });
    if (cfg.readout === null) cfg.readout = !!(cfg.secant || cfg.riemann || cfg.animate);
    return cfg;
  }

  /* ---------- block rendering ---------- */
  function gate(from, to, hide) {
    var s = ' data-from="' + (from || 0) + '"';
    if (to !== undefined && to !== Infinity) s += ' data-to="' + to + '"';
    if (hide) s += ' data-hide="' + hide + '"';
    return s;
  }
  var SC = 1; // global type scale; px() enforces the 14pt (19px) floor on the 1920x1080 stage
  function px(n) { return Math.max(19, Math.round(n * SC)) + 'px'; }
  function pxn(n) { return Math.max(19, Math.round(n * SC)); }
  function BODY() { return 'font-family:' + FT + ';font-size:' + px(36) + ';line-height:1.5;color:#111;text-wrap:pretty'; }

  function renderBlocks(blocks) {
    return blocks.map(renderBlock).join('');
  }
  function renderBlock(b) {
    switch (b.type) {
      case 'para':
        return '<p style="margin:0 0 18px;' + BODY() + '"' + gate(b.from) + '>' + inline(b.text) + '</p>';
      case 'space':
        return b.size === 'fill' ? '<div style="flex:1 1 auto"></div>' : '<div style="height:' + b.size + 'px"></div>';
      case 'list':
        return '<ul style="margin:0 0 18px;padding:0;list-style:none;display:flex;flex-direction:column;gap:' + (b.tight ? 8 : 16) + 'px">' +
          b.items.map(function (it) {
            var mark;
            if (it.marker !== null && it.marker !== undefined) {
              mark = it.marker === ''
                ? '<span style="width:12px;flex:0 0 auto"></span>'
                : '<span style="font-family:' + FM + ';font-size:' + px(24) + ';color:' + C.teal2 + ';flex:0 0 auto;padding-top:8px">' + inline(it.marker) + '</span>';
            } else if (b.ordered) {
              mark = '<span style="font-family:' + FM + ';font-size:' + px(26) + ';color:' + C.teal2 + ';min-width:38px;padding-top:8px">' + (b.items.indexOf(it) + 1) + '.</span>';
            } else {
              mark = '<span style="width:12px;height:12px;border-radius:50%;background:' + (it.sub ? C.blue2 : C.teal2) + ';flex:0 0 auto;margin-top:19px"></span>';
            }
            return '<li style="display:flex;gap:18px;align-items:flex-start;margin-left:' + (it.sub ? 52 : 0) + 'px"' + gate(it.from, it.to) + '>' +
              mark + '<span style="' + BODY() + '">' + inline(it.text) + '</span></li>';
          }).join('') + '</ul>';
      case 'math':
        return '<div style="margin:6px 0 20px;display:flex;flex-direction:column;gap:10px;align-items:flex-start">' +
          b.groups.map(function (g) {
            if (!g.src.trim()) return '';
            var src = b.env === 'equation' ? g.src : '\\begin{aligned}' + g.src + '\\end{aligned}';
            return '<div style="font-size:' + px(42) + '"' + gate(g.from) + '>' + tex(src, true) + '</div>';
          }).join('') + '</div>';
      case 'box':
        var titles = { theorem: 'Theorem', definition: 'Definition', example: 'Example', note: 'Note', proof: 'Proof' };
        var tone = { theorem: C.teal, definition: C.teal3, example: C.burnt, note: C.teal2, proof: '#555' }[b.kind] || C.teal;
        var bg = { theorem: C.mist, definition: C.mist, example: C.cream, note: C.mist, proof: '#fafafa' }[b.kind] || C.mist;
        return '<div style="margin:8px 0 22px;padding:22px 28px;background:' + bg + ';border-left:6px solid ' + tone + '"' + gate(b.from) + '>' +
          '<div style="font-family:' + FM + ';font-size:' + px(22) + ';letter-spacing:.14em;text-transform:uppercase;color:' + tone + ';margin-bottom:12px">' +
          (titles[b.kind] || b.kind) + (b.name ? ' &middot; <span style="text-transform:none;letter-spacing:.02em">' + esc(b.name) + '</span>' : '') + '</div>' +
          renderBlocks(b.blocks) + '</div>';
      case 'cols':
        var r = b.ratio.split(/[\s:]+/);
        return '<div style="display:grid;grid-template-columns:' + (num(r[0], 1)) + 'fr ' + (num(r[1], 1)) + 'fr;gap:56px;align-items:start">' +
          '<div>' + renderBlocks(b.a) + '</div><div>' + renderBlocks(b.b) + '</div></div>';
      case 'table':
        return '<table style="border-collapse:collapse;margin:8px 0 22px;font-family:' + FT + ';font-size:' + px(32) + '"' + gate(b.from) + '>' +
          b.rows.map(function (row, ri) {
            var head = b.header && ri === 0;
            return '<tr>' + row.map(function (c) {
              return '<' + (head ? 'th' : 'td') + ' style="padding:12px 28px 12px 0;text-align:left;' +
                (head ? 'font-family:' + FM + ';font-size:' + px(22) + ';letter-spacing:.12em;text-transform:uppercase;color:' + C.teal2 + ';border-bottom:2px solid ' + C.teal3
                  : 'border-bottom:1px solid ' + C.mist) + '">' + inline(c) + '</' + (head ? 'th' : 'td') + '>';
            }).join('') + '</tr>';
          }).join('') + '</table>';
      case 'image':
        return '<figure data-imageslot="' + escAttr(b.id) + '" style="margin:8px 0 20px"' + gate(b.from) + '>' +
          '<div data-drop="1" style="position:relative;min-height:360px;display:flex;align-items:center;justify-content:center;' +
          'border:2px dashed ' + C.pale + ';background:repeating-linear-gradient(45deg,#fcfcfb 0 10px,#f6f7f6 10px 20px);overflow:hidden">' +
          '<span data-hint="1" style="font-family:' + FM + ';font-size:' + px(20) + ';color:' + C.teal3 + ';text-align:center;padding:20px">' +
          'drop image &rarr; <b>' + esc(b.id) + '</b></span></div>' +
          (b.caption ? '<figcaption style="font-family:' + FM + ';font-size:' + px(20) + ';color:#666;margin-top:10px">' + inline(b.caption) + '</figcaption>' : '') +
          '</figure>';
      case 'plot':
        return '<figure data-plot="' + escAttr(JSON.stringify(b.cfg)) + '" style="margin:6px 0 16px"' + gate(b.cfg.from) + '>' +
          '<canvas style="width:' + b.cfg.w + 'px;height:' + b.cfg.h + 'px;display:block;max-width:100%"></canvas>' +
          (b.cfg.caption ? '<figcaption style="font-family:' + FM + ';font-size:' + px(20) + ';color:#666;margin-top:8px">' + inline(b.cfg.caption) + '</figcaption>' : '') +
          '</figure>';
      case 'js':
        return '<figure data-js="1" style="margin:6px 0 16px"' + gate(b.from) + '>' +
          '<canvas data-w="' + b.w + '" data-h="' + b.h + '" style="width:' + b.w + 'px;height:' + b.h + 'px;display:block;max-width:100%"></canvas>' +
          '<script type="text/x-lecture-js">' + b.code.replace(/<\//g, '<\\/') + '<\/script>' +
          (b.caption ? '<figcaption style="font-family:' + FM + ';font-size:' + px(20) + ';color:#666;margin-top:8px">' + esc(b.caption) + '</figcaption>' : '') +
          '</figure>';
      case 'group': return renderBlocks(b.blocks);
      default: return '';
    }
  }

  function slideHTML(slide, meta) {
    var pad = 'padding:96px 120px 132px';
    if (slide.kind === 'title') {
      return '<div style="' + pad + ';height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;gap:8px">' +
        '<div style="font-family:' + FM + ';font-size:' + px(24) + ';letter-spacing:.2em;text-transform:uppercase;color:' + C.teal3 + '">' + esc(meta.subtitle || '') + '</div>' +
        '<h1 style="font-family:' + FT + ';font-size:' + px(104) + ';line-height:1.05;font-weight:600;margin:14px 0 0;color:#111;max-width:1400px">' + inline(meta.title || '') + '</h1>' +
        '<div style="height:44px"></div>' +
        '<div style="font-family:' + FT + ';font-size:' + px(40) + ';color:#333">' + esc(meta.author || '') + '</div>' +
        '<div style="font-family:' + FM + ';font-size:' + px(24) + ';color:#666;margin-top:6px">' + esc(meta.date || '') + '</div>' +
        renderBlocks(slide.blocks) + '</div>';
    }
    if (slide.kind === 'divider') {
      return '<div style="' + pad + ';height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;background:' + C.mist + '">' +
        '<div style="font-family:' + FM + ';font-size:' + px(24) + ';letter-spacing:.2em;text-transform:uppercase;color:' + C.teal2 + '">Section</div>' +
        '<h2 style="font-family:' + FT + ';font-size:' + px(86) + ';line-height:1.1;font-weight:600;margin:16px 0 0;color:' + C.teal + ';max-width:1400px">' + inline(slide.title) + '</h2>' +
        renderBlocks(slide.blocks) + '</div>';
    }
    return '<div style="padding:58px 120px 132px;height:100%;box-sizing:border-box;display:flex;flex-direction:column">' +
      (slide.title ? '<h2 style="font-family:' + FT + ';font-size:' + px(58) + ';line-height:1.15;font-weight:600;margin:0 0 46px;color:#111">' + inline(slide.title) + '</h2>' : '') +
      '<div data-flow="1" style="flex:1 1 auto;min-height:0;transform-origin:top left">' + renderBlocks(slide.blocks) + '</div></div>';
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
    return v.toFixed(d);
  }
  function drawPlot(canvas, cfg, av) {
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

    var lo = Infinity, hi = -Infinity;
    for (var k = 0; k <= 400; k++) {
      var xx = x0 + (x1 - x0) * k / 400, yy = f(xx);
      if (isFinite(yy)) { lo = Math.min(lo, yy); hi = Math.max(hi, yy); }
      if (f2) { var y2 = f2(xx); if (isFinite(y2)) { lo = Math.min(lo, y2); hi = Math.max(hi, y2); } }
    }
    if (!isFinite(lo)) { lo = -1; hi = 1; }
    var y0, y1;
    if (zoomR) { y0 = zoomR[0]; y1 = zoomR[1]; }
    else if (cfg.range) { y0 = cfg.range[0]; y1 = cfg.range[1]; }
    else { var padv = (hi - lo || 2) * 0.16; y0 = Math.min(lo - padv, 0); y1 = hi + padv; }

    var M = { l: 74, r: 26, t: cfg.readout ? 74 : 26, b: 62 };
    var pw = W - M.l - M.r, ph = H - M.t - M.b;
    function X(x) { return M.l + (x - x0) / (x1 - x0) * pw; }
    function Y(y) { return M.t + ph - (y - y0) / (y1 - y0) * ph; }

    // grid
    var sx = niceStep(x1 - x0, 8), sy = niceStep(y1 - y0, 6);
    g.font = pxn(19) + 'px ' + FM.replace(/'/g, '"');
    if (cfg.grid) {
      g.strokeStyle = C.mist; g.lineWidth = 1;
      for (var gx = Math.ceil(x0 / sx) * sx; gx <= x1 + 1e-9; gx += sx) {
        g.beginPath(); g.moveTo(X(gx), M.t); g.lineTo(X(gx), M.t + ph); g.stroke();
      }
      for (var gy = Math.ceil(y0 / sy) * sy; gy <= y1 + 1e-9; gy += sy) {
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
        g.fillStyle = 'rgba(157,204,239,.55)';
        g.fillRect(X(xl), Y(Math.max(hv, 0)), X(xl + dw) - X(xl), Math.abs(Y(hv) - Y(0)));
        g.strokeStyle = C.teal3; g.lineWidth = 1;
        g.strokeRect(X(xl), Y(Math.max(hv, 0)), X(xl + dw) - X(xl), Math.abs(Y(hv) - Y(0)));
      }
    } else if (cfg.area) {
      g.beginPath(); g.moveTo(X(cfg.area[0]), Y(0));
      for (var q = 0; q <= 200; q++) { var ax = cfg.area[0] + (cfg.area[1] - cfg.area[0]) * q / 200; g.lineTo(X(ax), Y(f(ax))); }
      g.lineTo(X(cfg.area[1]), Y(0)); g.closePath();
      g.fillStyle = 'rgba(198,219,237,.6)'; g.fill();
    }

    // axes
    g.strokeStyle = '#222'; g.lineWidth = 2;
    var yAxis = (0 >= y0 && 0 <= y1) ? Y(0) : M.t + ph;
    var xAxis = (0 >= x0 && 0 <= x1) ? X(0) : M.l;
    g.beginPath(); g.moveTo(M.l, yAxis); g.lineTo(M.l + pw, yAxis); g.stroke();
    g.beginPath(); g.moveTo(xAxis, M.t); g.lineTo(xAxis, M.t + ph); g.stroke();
    g.fillStyle = '#555'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (var tx = Math.ceil(x0 / sx) * sx; tx <= x1 + 1e-9; tx += sx) {
      if (Math.abs(tx) < 1e-9) continue;
      g.beginPath(); g.moveTo(X(tx), yAxis - 5); g.lineTo(X(tx), yAxis + 5); g.strokeStyle = '#222'; g.stroke();
      g.fillText(fmtTick(tx, sx), X(tx), yAxis + 10);
    }
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (var ty = Math.ceil(y0 / sy) * sy; ty <= y1 + 1e-9; ty += sy) {
      if (Math.abs(ty) < 1e-9) continue;
      g.beginPath(); g.moveTo(xAxis - 5, Y(ty)); g.lineTo(xAxis + 5, Y(ty)); g.strokeStyle = '#222'; g.stroke();
      g.fillText(fmtTick(ty, sy), xAxis - 12, Y(ty));
    }
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#333'; g.font = 'italic ' + pxn(22) + 'px ' + FT.replace(/'/g, '"');
    g.fillText(cfg.xlabel, M.l + pw - 4, yAxis - 14);
    g.fillText(cfg.ylabel, xAxis + 12, M.t + 4);

    // curves
    function curve(fn, color, width, dash) {
      g.save(); g.beginPath(); g.setLineDash(dash || []); g.strokeStyle = color; g.lineWidth = width;
      g.rect(M.l, M.t, pw, ph); g.clip(); g.beginPath();
      var started = false;
      for (var s = 0; s <= 900; s++) {
        var xv = x0 + (x1 - x0) * s / 900, yv = fn(xv);
        if (!isFinite(yv)) { started = false; continue; }
        if (!started) { g.moveTo(X(xv), Y(yv)); started = true; } else g.lineTo(X(xv), Y(yv));
      }
      g.stroke(); g.restore();
    }
    if (f2) curve(f2, C.blue, 3, [8, 7]);
    curve(f, C.teal, 4);

    function dot(x, y, color, r) {
      g.beginPath(); g.arc(X(x), Y(y), r || 9, 0, 6.284);
      g.fillStyle = color; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    }
    function line(px, py, slope, color, width, dash) {
      g.save(); g.beginPath(); g.rect(M.l, M.t, pw, ph); g.clip();
      g.setLineDash(dash || []); g.strokeStyle = color; g.lineWidth = width;
      g.beginPath(); g.moveTo(X(x0), Y(py + slope * (x0 - px))); g.lineTo(X(x1), Y(py + slope * (x1 - px))); g.stroke();
      g.restore();
    }

    var a = cfg.a, fa = f(a), mSec = NaN, mTan = NaN;
    if (cfg.tangent) {
      var eh = 1e-5; mTan = (f(a + eh) - f(a - eh)) / (2 * eh);
      line(a, fa, mTan, C.red2, 3, [12, 8]);
    }
    if (cfg.secant) {
      var fb = f(a + h); mSec = (fb - fa) / h;
      line(a, fa, mSec, C.burnt, 4);
      // h bracket
      g.strokeStyle = C.orange; g.lineWidth = 2; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(X(a + h), Y(fb)); g.lineTo(X(a + h), Y(fa)); g.lineTo(X(a), Y(fa)); g.stroke();
      g.setLineDash([]);
      dot(a + h, fb, C.burnt);
    }
    if (cfg.secant || cfg.tangent || cfg.points) dot(a, fa, C.teal);
    (cfg.points || '').split(/[;,]/).forEach(function (p) {
      var v = parseFloat(p); if (isFinite(v)) dot(v, f(v), C.teal2, 7);
    });

    if (cfg.readout) {
      g.font = pxn(24) + 'px ' + FM.replace(/'/g, '"');
      g.textAlign = 'left'; g.textBaseline = 'top';
      var parts = [];
      if (cfg.secant) parts.push(['h = ' + fmt(h), C.burnt], ['m_sec = ' + fmt(mSec), C.burnt]);
      if (cfg.tangent) parts.push(["f'(" + fmt(a) + ') = ' + fmt(mTan), C.red2]);
      if (nR) parts.push(['n = ' + nR, C.teal3], ['sum = ' + fmt(sum), C.teal3]);
      if (cfg.animate && cfg.animate.key === 'zoom') parts.push(['window = ' + fmt(cfg.a - Math.abs(av)) + ' … ' + fmt(cfg.a + Math.abs(av)), C.teal3]);
      var cx = M.l;
      parts.forEach(function (p) {
        g.fillStyle = p[1]; g.fillText(p[0], cx, 22); cx += g.measureText(p[0]).width + 46;
      });
    }
  }

  /* ---------- mounting ---------- */
  function mountSlide(container, slide, meta, opts) {
    opts = opts || {};
    container.innerHTML = slideHTML(slide, meta || {});
    var step = 0, rafs = [], plots = [], jsFigs = [];

    // plots
    Array.prototype.forEach.call(container.querySelectorAll('[data-plot]'), function (fig) {
      var cfg = JSON.parse(fig.getAttribute('data-plot'));
      var canvas = fig.querySelector('canvas');
      var state = { cur: null, target: null, raf: 0 };
      function valueFor(st) {
        if (!cfg.animate) return cfg.hval;
        var k = clamp(st - cfg.from, 0, cfg.frames - 1), a = cfg.animate.from, b = cfg.animate.to;
        var u = cfg.frames === 1 ? 1 : k / (cfg.frames - 1);
        if (a > 0 && b > 0) return a * Math.pow(b / a, u);
        return a + (b - a) * u;
      }
      function tween(to) {
        state.target = to;
        if (state.cur === null) { state.cur = to; drawPlot(canvas, cfg, to); return; }
        var from = state.cur, t0 = performance.now(), dur = 520;
        cancelAnimationFrame(state.raf);
        (function loop(now) {
          var u = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - u, 3);
          state.cur = from + (to - from) * e;
          drawPlot(canvas, cfg, state.cur);
          if (u < 1) state.raf = requestAnimationFrame(loop);
        })(t0);
        rafs.push(function () { cancelAnimationFrame(state.raf); });
      }
      plots.push({ set: function (st) { tween(valueFor(st)); } });
      tween(valueFor(0));
    });

    // js figures
    Array.prototype.forEach.call(container.querySelectorAll('[data-js]'), function (fig) {
      var canvas = fig.querySelector('canvas');
      var code = (fig.querySelector('script') || {}).textContent || '';
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = +canvas.getAttribute('data-w'), hh = +canvas.getAttribute('data-h');
      canvas.width = w * dpr; canvas.height = hh * dpr;
      var ctx = canvas.getContext('2d');
      var live = [];
      function run(st) {
        live.forEach(function (id) { cancelAnimationFrame(id); }); live.length = 0;
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
          new Function('canvas', 'ctx', 'w', 'h', 'step', 'onFrame', 'colors', 'plot', code)
            (canvas, ctx, w, hh, st, onFrame, C, { compile: compile, draw: drawPlot });
        } catch (err) {
          ctx.fillStyle = C.red2; ctx.font = '22px monospace';
          ctx.fillText('js block error: ' + err.message, 20, 40);
        }
      }
      jsFigs.push({ set: run });
      rafs.push(function () { live.forEach(function (id) { cancelAnimationFrame(id); }); });
      run(0);
    });

    // image slots
    Array.prototype.forEach.call(container.querySelectorAll('[data-imageslot]'), function (fig) {
      var id = fig.getAttribute('data-imageslot');
      var drop = fig.querySelector('[data-drop]');
      var baked = (window.LECTURE_IMAGES || {})[id];
      var stored = baked;
      if (!stored) { try { stored = localStorage.getItem('lec-img:' + id); } catch (e) { } }
      function show(src) {
        drop.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:contain;display:block">';
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
          try { localStorage.setItem('lec-img:' + id, fr.result); } catch (err) { }
        };
        fr.readAsDataURL(file);
      });
    });

    function setStep(st) {
      step = clamp(st, 0, slide.steps);
      Array.prototype.forEach.call(container.querySelectorAll('[data-from]'), function (el) {
        var f = +el.getAttribute('data-from');
        var toA = el.getAttribute('data-to');
        var to = toA === null ? Infinity : +toA;
        var on = step >= f && step <= to;
        if (el.getAttribute('data-hide') === 'none') el.style.display = on ? '' : 'none';
        else { el.style.transition = 'opacity .3s ease'; el.style.opacity = on ? '1' : '0'; }
      });
      plots.forEach(function (p) { p.set(step); });
      jsFigs.forEach(function (j) { j.set(step); });
    }
    setStep(0);

    var flow = container.querySelector('[data-flow]');
    if (flow) {
      requestAnimationFrame(function () {
        var over = flow.scrollHeight - flow.clientHeight;
        var k = 1;
        if (over > 26) { // ignore the trailing block margin
          k = flow.clientHeight / flow.scrollHeight;
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
                Math.round(flow.offsetTop + box - 96) + 'px;height:96px;pointer-events:none;' +
                'background:linear-gradient(rgba(255,255,255,0),#fff 72%)';
              host.appendChild(fade);
            }
          }
          flow.style.transform = 'scale(' + k + ')';
          flow.style.width = (100 / k) + '%';
        }
        if (opts.onFit) opts.onFit(k);
      });
    }

    return {
      setStep: setStep,
      destroy: function () { rafs.forEach(function (f) { f(); }); container.innerHTML = ''; }
    };
  }

  /* ---------- published standalone build ---------- */
  var STANDALONE = function (SRC, IMGS, ENGINE) {
    return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + (SRC.title || 'Lecture') + '</title>' +
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">' +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">' +
      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>' +
      '<style>html,body{margin:0;height:100%;background:#fff;color:#111;font-family:' + FT + '}' +
      '#wrap{position:fixed;inset:0;overflow:hidden}#stage{position:absolute;top:0;left:0;width:1920px;height:1080px;transform-origin:top left;background:#fff}' +
      '#slide{position:absolute;inset:0}a{color:' + C.teal2 + '}a:hover{color:' + C.burnt + '}' +
      '#tray{position:absolute;left:0;right:0;bottom:0;height:92px;display:flex;align-items:center;gap:28px;padding:0 56px;box-sizing:border-box;' +
      'font-family:' + FM + ';font-size:22px;color:#555;background:linear-gradient(to top,rgba(255,255,255,.96),rgba(255,255,255,0));user-select:none}' +
      '.nb{width:60px;height:60px;border-radius:50%;border:1px solid ' + C.pale + ';background:rgba(255,255,255,.55);color:' + C.teal +
      ';display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;transition:background .18s,opacity .18s;opacity:.62}' +
      '.nb:hover{background:' + C.mist + ';opacity:1}#bar{position:absolute;left:0;bottom:0;height:4px;background:' + C.teal3 + ';transition:width .3s ease}' +
      '</style></head><body><div id="wrap"><div id="stage"><div id="slide"></div><div id="tray"></div><div id="bar"></div></div></div>' +
      '<script>window.LECTURE_IMAGES=' + JSON.stringify(IMGS) + ';window.LECTURE_SOURCE=' + JSON.stringify(SRC.source) + ';window.LECTURE_SCALE=' + SC + ';<\/script>' +
      (ENGINE ? '<script>' + ENGINE + '<\/script>' : '<script src="lecture-engine.js"><\/script>') +
      '<script>' + PLAYER.toString() + ';PLAYER();<\/script></body></html>';
  };

  function PLAYER() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('scale'); } catch (e) {}
    if (q && !isNaN(parseFloat(q))) window.Lecture.setScale(parseFloat(q));
    else if (window.LECTURE_SCALE) window.Lecture.setScale(window.LECTURE_SCALE);
    var parsed = window.Lecture.parse(window.LECTURE_SOURCE);
    var slides = parsed.slides, meta = parsed.meta;
    var si = 0, ctrl = null, step = 0;
    var stage = document.getElementById('stage'), slideEl = document.getElementById('slide');
    var tray = document.getElementById('tray'), bar = document.getElementById('bar');
    function fit() {
      var s = Math.min(innerWidth / 1920, innerHeight / 1080);
      stage.style.transform = 'scale(' + s + ')';
      stage.style.left = ((innerWidth - 1920 * s) / 2) + 'px';
      stage.style.top = ((innerHeight - 1080 * s) / 2) + 'px';
    }
    addEventListener('resize', fit); fit();
    var track = document.createElement('div');
    track.title = 'Drag to scrub through the deck';
    track.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:18px;cursor:ew-resize;z-index:6';
    stage.appendChild(track);
    track.addEventListener('pointerdown', function (e) {
      function pick(cx) {
        var r = track.getBoundingClientRect();
        if (!r.width) return;
        var u = Math.max(0, Math.min(0.9999, (cx - r.left) / r.width));
        var k = Math.floor(u * slides.length);
        if (k === si) return;
        si = k; step = 0; render();
      }
      function move(ev) { ev.preventDefault(); pick(ev.clientX); }
      function up() {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        bar.style.height = '4px'; bar.style.transition = 'width .3s ease';
      }
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      bar.style.height = '10px'; bar.style.transition = 'none';
      pick(e.clientX);
    });
    function chrome() {
      var total = slides.length;
      tray.innerHTML = '<div class="nb" id="prev">&#8592;</div><div class="nb" id="next">&#8594;</div>' +
        '<div style="flex:1 1 auto;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:24px;color:#125A56">' +
        (slides[si].section || meta.title || '') + '</div>' +
        '<div style="color:#999">' + (meta.copyright || '') + '</div>' +
        '<div style="color:#111">' + (si + 1) + ' / ' + total + '</div>';
      document.getElementById('prev').onclick = function () { go(-1); };
      document.getElementById('next').onclick = function () { go(1); };
      bar.style.width = ((si + 1) / total * 1920) + 'px';
    }
    function render() {
      if (ctrl) ctrl.destroy();
      ctrl = window.Lecture.mountSlide(slideEl, slides[si], meta, { readonly: true });
      ctrl.setStep(step);
      chrome();
    }
    function go(d) {
      if (d > 0) {
        if (step < slides[si].steps) { step++; ctrl.setStep(step); return; }
        if (si < slides.length - 1) { si++; step = 0; render(); }
      } else {
        if (step > 0) { step--; ctrl.setStep(step); return; }
        if (si > 0) { si--; step = slides[si].steps; render(); }
      }
    }
    addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') { si = 0; step = 0; render(); }
      else if (e.key === 'End') { si = slides.length - 1; step = 0; render(); }
    });
    render();
  }

  function publish(source, opts) {
    opts = opts || {};
    var parsed = parse(source);
    var imgs = {};
    parsed.slides.forEach(function (s) {
      (function walk(bs) {
        bs.forEach(function (b) {
          if (b.type === 'image') { try { var v = localStorage.getItem('lec-img:' + b.id); if (v) imgs[b.id] = v; } catch (e) { } }
          if (b.blocks) walk(b.blocks);
          if (b.a) { walk(b.a); walk(b.b); }
        });
      })(s.blocks);
    });
    function build(engineSrc) {
      var html = STANDALONE({ title: parsed.meta.title, source: source }, imgs, engineSrc);
      var blob = new Blob([html], { type: 'text/html' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (parsed.meta.title || 'lecture').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase() + '.html';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      if (opts.done) opts.done(!!engineSrc);
    }
    fetch(ENGINE_URL).then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(build).catch(function () { build(null); });
  }

  var STARTER = "% Lines beginning with % are comments and never appear on a slide.\n\\title{Lecture N — Topic}\n\\course{MATH 1131Q — Calculus I}\n\\author{Matthew Badger}\n\\date{Month D, YYYY}\n\\copyright{(C) Matthew Badger 2026}\n\n\\titleslide\n\n\\section{First idea}\n\n\\slide{A slide with steps}\nOne sentence of setup, with inline math $f(x)=x^2$ in it.\n\\pause\n\\begin{itemize}\n\\item First point\n\\pause\n\\item Second point, with \\alert{emphasis}\n\\end{itemize}\n\n\\slide{A derivation}\n\\begin{align}\n\\frac{f(a+h)-f(a)}{h} &= \\text{something} \\\\[2pt]\n\\pause\n&= \\text{something simpler}\n\\end{align}\n\\pause\n\\begin{definition}{Name}\nState the definition here.\n\\end{definition}\n\n\\slide{A plot that animates on \\pause}\n\\begin{plot}\nf = x^2\ndomain = -0.5:3\na = 1\nsecant = true\ntangent = true\nsize = 1000x460\nframes = 6\nanimate = h: 1.6 -> 0.05\ncaption = caption text\n\\end{plot}\n\n\\slide{Two columns and a drop slot}\n\\begin{twocol}\nText on the left.\n\\columnbreak\n\\imageslot{fig-1}{Drop a figure here}\n\\end{twocol}\n";

  window.Lecture = {
    starter: STARTER,
    setScale: function (k) { SC = Math.max(0.8, Math.min(1.6, +k || 1)); return SC; },
    getScale: function () { return SC; },
    parse: parse, mountSlide: mountSlide, slideHTML: slideHTML,
    publish: publish, colors: C, fonts: { text: FT, mono: FM }, compile: compile
  };
})();
