/**
 * Browser QA: text overlap / clipping detector.
 *
 * Paste into the DevTools console (or run via the browser tool) on the built
 * page, at each viewport you test. Reports pairs of visible text elements
 * whose boxes intersect (excluding ancestor/descendant relations) and text
 * clipped by the viewport edges — the "sticky nav over the headline" class
 * of defect that static analysis cannot see.
 */
(() => {
  const nodes = [...document.querySelectorAll("h1,h2,h3,h4,p,a,button,li,span,figcaption,blockquote")]
    .filter((el) => {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.1) return false;
      const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2);
      return text && el.getClientRects().length > 0;
    });

  const boxes = nodes.map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 4 && rect.height > 4);

  const problems = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const overlapX = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const overlapY = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (overlapX > 8 && overlapY > 8) {
        problems.push(`OVERLAP: <${a.el.tagName.toLowerCase()}> "${a.el.textContent.trim().slice(0, 40)}" x <${b.el.tagName.toLowerCase()}> "${b.el.textContent.trim().slice(0, 40)}" (${Math.round(overlapX)}x${Math.round(overlapY)}px)`);
      }
    }
  }

  const docWidth = document.documentElement.clientWidth;
  for (const { el, rect } of boxes) {
    if (rect.right > docWidth + 1 || rect.left < -1) {
      problems.push(`CLIPPED: <${el.tagName.toLowerCase()}> "${el.textContent.trim().slice(0, 40)}" exits the viewport (left ${Math.round(rect.left)}, right ${Math.round(rect.right)}, viewport ${docWidth})`);
    }
  }

  const unique = [...new Set(problems)];
  console.log(unique.length === 0 ? "overlap-check: clean" : unique.join("\n"));
  return unique;
})();
