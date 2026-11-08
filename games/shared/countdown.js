/* BAR shared countdown v1.0.0
 * Keep the clock based on elapsed monotonic time, not interval tick counts.
 */
(() => {
  'use strict';
  if (window.GameCountdown) return;
  function create({ onTick, onFinish, intervalMs = 100 } = {}) {
    let intervalId = null;
    let deadline = 0;
    let remaining = 0;
    const tick = () => {
      remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      if (typeof onTick === 'function') onTick(remaining);
      if (remaining === 0) {
        stop();
        if (typeof onFinish === 'function') onFinish();
      }
    };
    function stop() {
      if (intervalId !== null) clearInterval(intervalId);
      intervalId = null;
    }
    function start(seconds) {
      stop();
      remaining = Math.max(0, Math.ceil(Number(seconds) || 0));
      deadline = performance.now() + remaining * 1000;
      if (typeof onTick === 'function') onTick(remaining);
      if (remaining === 0) {
        if (typeof onFinish === 'function') onFinish();
        return;
      }
      intervalId = setInterval(tick, intervalMs);
    }
    return Object.freeze({
      start, stop,
      getRemaining: () => remaining,
      isRunning: () => intervalId !== null
    });
  }
  window.GameCountdown = Object.freeze({ create });
})();
