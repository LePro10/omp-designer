/**
 * KINEMATICA — Robot panel telemetry simulation
 * Cycles joint angles within plausible ranges to simulate a live controller.
 * Respects prefers-reduced-motion.
 */

(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (REDUCED) return;

  const ids = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'];
  const ranges = [
    { min: -170, max: 170 },   // J1
    { min: -90, max: 90 },     // J2
    { min: -135, max: 135 },   // J3
    { min: -190, max: 190 },   // J4
    { min: -120, max: 120 },   // J5
    { min: -360, max: 360 },   // J6
  ];

  // Initial target values
  const targets = [];
  const currents = [];

  for (let i = 0; i < ids.length; i++) {
    const init = +(Math.random() * (ranges[i].max - ranges[i].min) + ranges[i].min).toFixed(1);
    targets[i] = init;
    currents[i] = init;
  }

  function format(deg) {
    const sign = deg >= 0 ? '+' : '\u2212';
    return sign + Math.abs(deg).toFixed(1) + '\u00B0';
  }

  function updateDisplay() {
    for (let i = 0; i < ids.length; i++) {
      const el = document.getElementById(ids[i]);
      if (el) el.textContent = format(currents[i]);
    }
  }

  let animId = null;

  function tick() {
    // Pick a new random target for one joint each frame
    const idx = Math.floor(Math.random() * ids.length);
    targets[idx] = +(Math.random() * (ranges[idx].max - ranges[idx].min) + ranges[idx].min).toFixed(1);

    // Ease all joints a fraction toward their target
    for (let i = 0; i < ids.length; i++) {
      const diff = targets[i] - currents[i];
      currents[i] += diff * 0.08;
      // Snap when close
      if (Math.abs(diff) < 0.05) currents[i] = targets[i];
    }

    updateDisplay();
    animId = setTimeout(tick, 1200 + Math.random() * 1800);
  }

  tick();
})();
