import assert from 'node:assert/strict';

// Check the visible reading across the whole recording, including midnight and
// every light phase. Checking only the first frame misses moving clock labels.
export async function checkReplayReadingStability(page) {
  const samples = await page.evaluate(() => {
    const range = document.querySelector('[data-replay-time]');
    const phase = document.querySelector('[data-replay-phase]');
    const reading = document.querySelector('.ride-replay__reading');
    const samples = [];
    for (let value = 0; value <= 1000; value++) {
      range.value = String(value);
      range.dispatchEvent(new Event('input', { bubbles: true }));
      const label = phase.getBoundingClientRect();
      const group = reading.getBoundingClientRect();
      samples.push({ phase: phase.textContent, x: label.x - group.x, y: label.y - group.y });
    }
    range.value = '0';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    return samples;
  });
  for (const axis of ['x', 'y']) {
    const positions = samples.map(sample => sample[axis]);
    const shift = Math.max(...positions) - Math.min(...positions);
    assert(shift < 0.5, `Replay light label moves ${shift}px along ${axis} during playback`);
  }
  assert.equal(new Set(samples.map(sample => sample.phase)).size, 4, 'Replay covers all four light phases');
}
