import assert from 'node:assert/strict';

// Historical time colours the replay but must not take ownership of the site
// theme, pause position or selected sound scene.
export async function checkReplayAppearance(page) {
  const samples = await page.evaluate(() => {
    const root = document.documentElement;
    const panel = document.querySelector('[data-ride-replay]');
    const slider = panel.querySelector('[data-replay-time]');
    const originalTheme = root.dataset.theme;
    const originalTime = slider.value;
    const seek = value => {
      slider.value = String(value);
      slider.dispatchEvent(new Event('input', {bubbles:true}));
    };
    const theme = value => document.querySelector(`.site-footer [data-theme-option="${value}"]`).click();
    const read = () => ({
      value: slider.value,
      clock: panel.querySelector('[data-replay-clock]').textContent,
      phase: panel.querySelector('[data-replay-phase]').textContent,
      distance: panel.querySelector('[data-replay-distance]').textContent,
      playing: panel.querySelector('[data-replay-play]').dataset.playing,
      sound: [...panel.querySelectorAll('[data-presence-scene]')].map(el => [el.getAttribute('aria-pressed'), el.dataset.playing]),
    });
    const phases = new Map();
    for (let value = 0; value <= 1000; value += 5) {
      seek(value);
      const phase = read().phase;
      if (!phases.has(phase)) phases.set(phase, value);
    }
    const result = [];
    for (const [phase, value] of phases) {
      seek(value);
      const sample = {phase};
      for (const mode of ['light', 'dark']) {
        theme(mode);
        sample[mode] = {
          reading: read(),
          replay: getComputedStyle(panel, '::before').background,
          surrounding: getComputedStyle(document.querySelector('.manifesto')).background,
          audio: getComputedStyle(panel.querySelector('#presence')).backgroundColor,
        };
      }
      result.push(sample);
    }
    theme(originalTheme);
    seek(originalTime);
    return result;
  });
  assert.equal(samples.length, 4, 'Appearance covers day, sunset, night and dawn in the recording');
  for (const sample of samples) {
    assert.deepEqual(sample.light.reading, sample.dark.reading, 'Changing theme preserves the recording and sound selection');
    assert.equal(sample.dark.reading.playing, 'false', 'Theme changes do not start playback');
    assert.notEqual(sample.light.replay, sample.dark.replay, `${sample.phase}: historical light respects the chosen theme`);
    assert.equal(sample.dark.audio, 'rgba(0, 0, 0, 0)', 'The sound scenes share the replay surface');
  }
  for (const mode of ['light', 'dark']) {
    assert.equal(new Set(samples.map(sample => sample[mode].surrounding)).size, 1, 'Replay time does not recolour the rest of the site');
    assert.equal(new Set(samples.map(sample => sample[mode].replay)).size, 4, 'Historical daylight is still visible within either theme');
  }
}
