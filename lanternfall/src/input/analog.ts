export interface Stick {
  x: number;
  y: number;
}

/**
 * Radial deadzone for an analog stick. Inside `dead` the stick reads zero; outside it the
 * remaining range is rescaled so the output still smoothly reaches length 1 (no sudden jump
 * at the edge of the deadzone). Output length is always <= 1.
 */
export function radialDeadzone(x: number, y: number, dead = 0.2): Stick {
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len <= dead) return { x: 0, y: 0 };
  const scaled = Math.min(1, (len - dead) / (1 - dead));
  return { x: (x / len) * scaled, y: (y / len) * scaled };
}

/**
 * Virtual (on-screen) stick: the finger is `dx, dy` pixels from the stick centre and the stick
 * has `radius` pixels of travel. Returns a vector of length <= 1 after the deadzone.
 */
export function stickVector(dx: number, dy: number, radius: number, dead = 0.15): Stick {
  if (radius <= 0) return { x: 0, y: 0 };
  return radialDeadzone(dx / radius, dy / radius, dead);
}

/** Squash small stick movements for finer aiming: curve 1 is linear, 2 is quadratic. */
export function responseCurve(v: number, curve = 1.6): number {
  return Math.sign(v) * Math.abs(v) ** curve;
}
