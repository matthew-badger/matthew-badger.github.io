# CRM talk — build notes

`talk.html` is self-contained: the player, the source, KaTeX, and the Spectral and JetBrains Mono
fonts are inside the file, and it makes no network requests. Graphics load by relative path, so keep
`talk.html` in the same folder as the figures.

## Keys
`→` / space / Page Down advance; `←` / Page Up go back; Home and End jump to the first and last slide;
`f` toggles full screen; **digits then `g`** jump to that slide (e.g. `2` `4` `g`); **`c`** toggles an
elapsed-time clock next to the slide counter (it starts the first time you press `c`).
Opening `talk.html#24` starts at slide 24.

**Appendices.** A line `\appendix` (on its own) starts the appendices. Slides after it are numbered A1, A2, …
and do not count in the total: the counter reads `k / N` with N the number of main slides, the progress bar
and the scrub track cover only the main slides, `→` continues from the last main slide into A1, A2, …, and End
and digits-then-g stay within the main slides.

**External links.** `\href{url}{text}` makes an underlined link that opens in a new tab (used for the arXiv number on the closing slide).

**Section slides.** `\section{Name}` makes a divider slide and sets the footer; `\section*{Name}` only sets the footer (used for the appendices).

**Links to appendices.** `\slide[label=app-x]{…}` names a slide, and `\goto{app-x}{text}` anywhere in slide
text draws a small clickable pill that jumps there. After a jump, a "↩ Back to slide N" button appears at the
top right of the slide (the key **b** does the same) and returns to the slide and step you came from.

## Building
```
node build.mjs wustl.tex talk.html --scale=1.2   # base type scale, as in the lectures
```
`build.mjs` needs `npm install katex@0.16.11 @fontsource/spectral @fontsource/jetbrains-mono` once.

## Source format
The source is the lecture-engine v2 dialect (README-v2.md) with these additions, all in
`talk-engine.js`, which `make_engine.py` derives from `lecture-engine-v2.js`:

- `\newcommand{\name}[n]{body}` lines in the preamble become KaTeX macros for the whole deck.
- `\includegraphics<spec>[width=…, height=…, alt="…"]{file}` on its own line shows an image file by
  relative path; sizes are stage pixels (the stage is 1920 × 1080). It takes overlay specs and steps
  like any block. SVG, PNG, and JPG all work.
- `\autofit{1.45}` in the preamble: on each slide the type grows from the base scale up to 1.45 while
  the slide's tallest step still fits, in height and in width (no display or box may overflow sideways).
  Slide titles stay at the base size so they line up from slide to slide. A slide that is too tall
  at the base scale is shrunk, as in v2. `\slide[maxscale=1.3]{…}` caps one slide; `maxscale=0`
  turns growth off for it; `scale=` still sets its base.
- `\spread{on}` in the preamble: the top-level blocks of each slide are spaced evenly down the slide
  when there is room left over. `\slide[spread=off]{…}` turns it off for one slide; `\vfill` and
  `valign=` still work and take precedence.
- Labeled boxes `lemma`, `proposition`, `corollary` (theorem colors), `principle`, `conjecture`
  (note colors), `challenge`, `openproblem` (question colors).

The `fig-*.svg` files are the paper's TikZ figures compiled as standalone pictures, so the notation
matches the paper exactly.
