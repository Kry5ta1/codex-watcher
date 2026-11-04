// Shared validation for the Electron boundary and browser theme controls.
const THEMES = ["classic", "whale", "dragon"];
function normalizeAppearance(value) {
  return {
    theme: THEMES.includes(value?.theme) ? value.theme : "classic",
    focusMode: value?.focusMode === true
  };
}
module.exports = { THEMES, normalizeAppearance };
