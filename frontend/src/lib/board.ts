// Pure geometry helpers for the pinboard. Kept free of React so the
// screen<->board coordinate math and string-curve math can be reasoned about
// (and unit-tested) in isolation.

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

// Card dimensions in board space. Strings anchor to the pushpin at the
// card's top-center, which is height-independent (so variable card content
// never moves the string attachment point).
export const CARD_WIDTH = 196;
export const PIN_ANCHOR_DY = 2;

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2;

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
}

// The pushpin anchor (top-center) of a card positioned at (x, y).
export function pinAnchor(card: Point): Point {
  return { x: card.x + CARD_WIDTH / 2, y: card.y + PIN_ANCHOR_DY };
}

// Convert a screen (clientX/Y) point into board space, given the canvas
// element's bounding rect and the current viewport transform
// (board is rendered as: translate(panX, panY) scale(zoom)).
export function screenToBoard(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  vp: Viewport
): Point {
  return {
    x: (clientX - rect.left - vp.panX) / vp.zoom,
    y: (clientY - rect.top - vp.panY) / vp.zoom,
  };
}

// Undirected key for a task pair (order-independent) — dedupes A-B vs B-A.
export function pairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function connectionKey(c: { aTaskId: string; bTaskId: string }): string {
  return pairKey(c.aTaskId, c.bTaskId);
}

// Build the SVG path + label anchor for a string hanging between two pins.
// The control point drops below the chord by a sag proportional to length,
// giving the classic slack-string look.
export function stringGeometry(a: Point, b: Point): { path: string; mid: Point } {
  const ctrlX = (a.x + b.x) / 2;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(56, dist * 0.16);
  const ctrlY = (a.y + b.y) / 2 + sag;
  const path = `M ${a.x} ${a.y} Q ${ctrlX} ${ctrlY} ${b.x} ${b.y}`;
  // Quadratic Bézier point at t=0.5 = 0.25*a + 0.5*ctrl + 0.25*b.
  const mid: Point = {
    x: 0.25 * a.x + 0.5 * ctrlX + 0.25 * b.x,
    y: 0.25 * a.y + 0.5 * ctrlY + 0.25 * b.y,
  };
  return { path, mid };
}
