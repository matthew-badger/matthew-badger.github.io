// Screenshot every slide of a built talk: node shoot.mjs out/talk.html shots [first-last] [--wait=ms]
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const [file = 'out/talk.html', dir = 'shots', range = ''] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const waitArg = process.argv.find((a) => a.startsWith('--wait='));
const wait = waitArg ? +waitArg.split('=')[1] : 900;
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
const url = 'file://' + path.resolve(file);
await page.goto(url + '#1'); await page.waitForTimeout(800);
const total = await page.evaluate(() => window.Lecture.parse(window.LECTURE_SOURCE).slides.length);
let [a, b] = range ? range.split('-').map(Number) : [1, total]; if (!b) b = a;
for (let k = a; k <= b; k++) {
  await page.goto('about:blank'); await page.goto(url + '#' + k);
  await page.waitForTimeout(wait);
  const info = await page.evaluate(() => {
    const s = document.querySelector('.lec-slide');
    const fade = !!document.querySelector('[data-fade]');
    const k = s ? s.style.getPropertyValue('--k') : '';
    const err = Array.from(document.querySelectorAll('canvas')).length;
    const kat = document.querySelectorAll('.katex-error').length;
    return { k, fade, canvases: err, kat };
  });
  console.log('slide', k, JSON.stringify(info));
  await page.screenshot({ path: path.join(dir, 's' + String(k).padStart(2, '0') + '.png') });
}
if (errs.length) console.log('console:', [...new Set(errs)].join('\n'));
await browser.close();
