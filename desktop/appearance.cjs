// Shared validation for the Electron boundary and browser theme controls.
const THEMES = ["classic", "whale", "dragon"];
function normalizeAppearance(value) {
  return {
    theme: THEMES.includes(value?.theme) ? value.theme : "classic",
    focusMode: value?.focusMode === true
  };
}
const THEME_TRANSPARENCY = Object.freeze({ classic: 15, whale: 10, dragon: 0 });
function themeTransparency(theme) {
  return THEME_TRANSPARENCY[normalizeAppearance({ theme }).theme];
}
module.exports = { THEMES, normalizeAppearance, THEME_TRANSPARENCY, themeTransparency };
