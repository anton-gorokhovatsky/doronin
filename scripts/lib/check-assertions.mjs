export function expect(condition, message) {
  if (!condition) throw new Error(message);
}

export function near(first, second, tolerance = 0.75) {
  return Math.abs(first - second) <= tolerance;
}
