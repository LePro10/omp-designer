/* ══════════════════════════════════════════
   Leak Furniture — Interactions
   ══════════════════════════════════════════ */

(function(){
  'use strict';

  // Mark JS active (replaces no-js)
  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  /* ── Kinetic type: split "Leak" into letters ── */
  const kineticEl = document.querySelector('.hero-kinetic');
  let letters = [];

  if (kineticEl) {
    const word = kineticEl.dataset.word || 'Leak';
    letters = word.split('').map((ch, i) => {
      const span = document.createElement('span');
      span.className = 'kinetic-letter';
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      span.dataset.i = i;
      kineticEl.appendChild(span);
      return span;
    });

    // Kinetic pointer interaction
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isReduced && letters.length) {
      const hero = document.querySelector('.hero');
      hero.addEventListener('pointermove', (e) => {
        const rect = kineticEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;

        letters.forEach((letter, i) => {
          const offset = (i - letters.length / 2) * 0.15;
          const tx = dx * (3 + offset * 1.5);
          const ty = dy * (2 + Math.abs(offset) * 0.8);
          const rot = dx * (1.5 + offset * 0.5);
          letter.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
        });
      });

      hero.addEventListener('pointerleave', () => {
        letters.forEach((l) => l.style.transform = '');
      });
    }
  }

  /* ── Scroll reveal ── */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const ro = new ResizeObserver(() => {
      // re-observe on resize (lazy images may change heights)
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '-10% 0px', threshold: 0.05 });

    revealEls.forEach((el) => io.observe(el));
  }

  /* ── Smooth scroll for anchor links (KB accessible) ── */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const id = anchor.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Update focus for accessibility
        if (!target.hasAttribute('tabindex')) {
          target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
        }
      }
    });
  });

  /* ── Header background on scroll ── */
  const header = document.querySelector('.site-header');
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > 50) {
      header.style.borderBottomColor = '#D6CCC2';
    } else {
      header.style.borderBottomColor = '#D6CCC2';
    }
  }, { passive: true });

})();
