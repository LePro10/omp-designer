/**
 * Structured design-review rubric.
 *
 * This is deliberately NOT an automatic objective score. Each category must be
 * filled by a human or a review model and every non-null score requires a reason.
 * It exists so visual/design quality can be recorded consistently next to the
 * automated delivery checks — not to gate a release on taste.
 *
 * Scale (0–2):
 *   0 = clear problem in this dimension (with a concrete reason)
 *   1 = acceptable / no notable problem
 *   2 = genuinely strong, specific to this product
 *   null = not yet reviewed
 */
export const REVIEW_SCALE = Object.freeze({ min: 0, max: 2 });

export const REVIEW_LEVELS = Object.freeze({
  0: "clear problem in this dimension",
  1: "acceptable, no notable problem",
  2: "genuinely strong and product-specific",
});

// Category key -> what the reviewer is judging.
export const REVIEW_CATEGORIES = Object.freeze({
  visualHierarchy: "Is attention guided; is there one dominant idea per section?",
  brandSpecificity: "Does the design read as this product, not a generic template?",
  compositionOriginality: "Does composition avoid repeated equal card-grid clones?",
  mobileQuality: "Is the narrow viewport composed deliberately, without overflow?",
  navigationQuality: "Is navigation coherent and are routes/links real and reachable?",
  accessibilityBasics: "Focus visibility, contrast, semantics, reduced-motion respect.",
  motionRestraint: "Is motion purposeful rather than default decoration?",
  evidenceIntegrity: "Are visible claims supported by user/source facts, not invented?",
  userIntentFit: "Does the result match the explicit user request and decisions?",
  nonGenericity: "Does it avoid a generic AI/Apple/Linear/Stripe clone look?",
});

export const REVIEW_CATEGORY_KEYS = Object.freeze(Object.keys(REVIEW_CATEGORIES));

/** A blank rubric: every category unscored, ready for a reviewer to fill. */
export function emptyReview() {
  const review = {};
  for (const key of REVIEW_CATEGORY_KEYS) {
    review[key] = { score: null, reason: "" };
  }
  return review;
}

/**
 * Validate a rubric object. Returns { ok, errors }.
 * A category may be left unscored (score: null), but any numeric score must be
 * an integer within the scale AND carry a non-empty reason — no silent numbers.
 */
export function validateReview(review) {
  const errors = [];
  if (!review || typeof review !== "object") {
    return { ok: false, errors: ["review must be an object"] };
  }
  for (const key of REVIEW_CATEGORY_KEYS) {
    const entry = review[key];
    if (!entry || typeof entry !== "object") {
      errors.push(`missing category: ${key}`);
      continue;
    }
    const { score, reason } = entry;
    if (score === null || score === undefined) continue; // unscored is allowed
    if (!Number.isInteger(score) || score < REVIEW_SCALE.min || score > REVIEW_SCALE.max) {
      errors.push(`${key}: score must be an integer in ${REVIEW_SCALE.min}..${REVIEW_SCALE.max}`);
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      errors.push(`${key}: a scored category requires a reason`);
    }
  }
  for (const key of Object.keys(review)) {
    if (!REVIEW_CATEGORY_KEYS.includes(key)) errors.push(`unknown category: ${key}`);
  }
  return { ok: errors.length === 0, errors };
}
