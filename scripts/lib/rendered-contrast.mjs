import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

// Transparent groups over a fixed pseudo-element are not reliably composited by axe.
// Sample their real rendered background, with only the audited text made transparent.
export async function checkRenderedTextContrast(page, selector) {
  const text = await page.locator(selector).evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const runs = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent.trim()) continue;
      const style = getComputedStyle(node.parentElement);
      if (style.visibility !== 'visible') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1 || rect.bottom <= 0 || rect.top >= innerHeight) continue;
        runs.push({
          label: node.textContent.trim(), color: style.color,
          size: parseFloat(style.fontSize), weight: Number(style.fontWeight),
          left: Math.max(0, Math.ceil(rect.left)), right: Math.min(innerWidth, Math.floor(rect.right)),
          top: Math.max(0, Math.ceil(rect.top)), bottom: Math.min(innerHeight, Math.floor(rect.bottom)),
        });
      }
    }
    return runs;
  });
  assert(text.length > 0, `No visible text to check in ${selector}`);
  const override = await page.addStyleTag({ content: `${selector}, ${selector} * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }` });
  let background;
  try {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const masked = await page.locator(selector).evaluate(el => ({ color: getComputedStyle(el.querySelector('span')).color, fill: getComputedStyle(el.querySelector('span')).webkitTextFillColor }));
    assert.equal(masked.fill, 'rgba(0, 0, 0, 0)', JSON.stringify(masked));
    background = await page.screenshot({ scale: 'css' });
  }
  finally { await override.evaluate(element => element.remove()); }
  const results = await page.evaluate(async ({ runs, png }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const luminance = rgb => rgb.map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, channel, i) => sum + channel * [0.2126, 0.7152, 0.0722][i], 0);
    return runs.map(run => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = run.color;
      context.fillRect(0, 0, 1, 1);
      const foreground = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
      const fg = luminance(foreground);
      let minimum = Infinity;
      for (let y = run.top; y < run.bottom; y += 2) {
        for (let x = run.left; x < run.right; x += 2) {
          const index = (y * canvas.width + x) * 4;
          const bg = luminance([pixels[index], pixels[index + 1], pixels[index + 2]]);
          minimum = Math.min(minimum, (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05));
        }
      }
      return { label: run.label, ratio: minimum, required: run.size >= 24 || (run.size >= 18.66 && run.weight >= 700) ? 3 : 4.5 };
    });
  }, { runs: text, png: background.toString('base64') });
  if (results.some(result => !Number.isFinite(result.ratio) || result.ratio < result.required)) {
    await writeFile('tmp/dubai-light-check/contrast-background.png', background);
    await writeFile('tmp/dubai-light-check/contrast-runs.json', JSON.stringify({ text, results }, null, 2));
  }
  for (const result of results) {
    assert(Number.isFinite(result.ratio) && result.ratio >= result.required, `Rendered contrast in ${selector}: ${JSON.stringify(result)}`);
  }
  return results;
}
