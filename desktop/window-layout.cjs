// Electron screen/workArea and BrowserWindow bounds are already device-independent
// pixels. Never multiply them by display.scaleFactor (which would double-count DPI).
const MIN_WIDTH = 420;
const DEFAULT_SIZE = { width: 440, height: 780 };

function validBounds(value) {
  return value && ["x", "y", "width", "height"].every((key) => Number.isFinite(value[key])) &&
    value.width > 0 && value.height > 0;
}

function normalizeContentSize(value) {
  if (!value || ![value.width, value.height].every((number) =>
    typeof number === "number" && Number.isFinite(number) && number > 0 && number <= 20000)) return null;
  return { width: Math.ceil(value.width), height: Math.ceil(value.height) };
}

function selectWorkArea(bounds, displays, primaryId) {
  const usable = displays.filter((display) => validBounds(display.workArea));
  if (!usable.length) throw new Error("No usable display work area.");
  const primary = usable.find((display) => display.id === primaryId) ?? usable[0];
  if (!validBounds(bounds)) return primary.workArea;
  let best = primary;
  let bestOverlap = 0;
  for (const display of usable) {
    const area = display.workArea;
    const overlap = Math.max(0, Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)) *
      Math.max(0, Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y));
    if (overlap > bestOverlap) { best = display; bestOverlap = overlap; }
  }
  // Restore fully off-screen saved windows to the primary display, not a stale
  // coordinate from a disconnected monitor.
  return best.workArea;
}

function fitWindowLayout(bounds, area, measured) {
  if (!validBounds(area)) throw new Error("Invalid display work area.");
  const areaWidth = Math.max(1, Math.floor(area.width));
  const areaHeight = Math.max(1, Math.floor(area.height));
  const current = validBounds(bounds) ? bounds : {
    ...DEFAULT_SIZE,
    x: area.x + Math.round((areaWidth - Math.min(DEFAULT_SIZE.width, areaWidth)) / 2),
    y: area.y + Math.round((areaHeight - Math.min(DEFAULT_SIZE.height, areaHeight)) / 2)
  };
  // Keep a stable natural width during screen-fit scaling. Expanding width by
  // 1/scale here would change wrapping, then height, then scale on every report.
  const naturalWidth = Math.max(MIN_WIDTH, Math.min(Math.round(current.width), areaWidth));
  const content = normalizeContentSize(measured);
  const naturalHeight = content?.height ?? DEFAULT_SIZE.height;
  const scale = Math.min(1, areaWidth / naturalWidth, areaHeight / naturalHeight);
  const minWidth = Math.max(1, Math.min(areaWidth, Math.ceil(MIN_WIDTH * scale)));
  const minHeight = Math.max(1, Math.min(areaHeight, Math.ceil(naturalHeight * scale)));
  const width = Math.min(areaWidth, Math.max(Math.round(current.width), Math.ceil(naturalWidth * scale), minWidth));
  const height = Math.min(areaHeight, Math.max(Math.round(current.height), minHeight));
  const x = Math.round(Math.min(Math.max(current.x, area.x), area.x + areaWidth - width));
  const y = Math.round(Math.min(Math.max(current.y, area.y), area.y + areaHeight - height));
  return {
    bounds: { x, y, width, height },
    minimum: { width: minWidth, height: minHeight },
    layout: { scale, width: naturalWidth, height: naturalHeight }
  };
}

module.exports = { MIN_WIDTH, DEFAULT_SIZE, normalizeContentSize, selectWorkArea, fitWindowLayout };
