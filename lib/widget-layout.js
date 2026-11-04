// CSS pixels are device-independent here: do not multiply by devicePixelRatio.
export function fitContentScale(width, height, viewportWidth, viewportHeight, preferredScale = 1) {
  const values = [width, height, viewportWidth, viewportHeight, preferredScale];
  if (!values.every((value) => Number.isFinite(value) && value > 0)) return 1;
  return Math.min(1, preferredScale, viewportWidth / width, viewportHeight / height);
}
