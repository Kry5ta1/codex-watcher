import appearance from "../desktop/appearance.cjs";

export const { normalizeAppearance } = appearance;
export const APPEARANCE_KEY = "codex-watcher-appearance-v1";
export const THEME_OPTIONS = [
  { id: "classic", label: "经典", name: "经典墨绿", subtitle: "简洁、熟悉，专注工作" },
  { id: "whale", label: "深海", name: "深海女仆", subtitle: "把灵感收好，慢慢完成它", image: "/themes/whale-maid.png", alt: "原创蓝发鲸鱼女仆，抱着小鲸鱼向你挥手" },
  { id: "dragon", label: "白龙", name: "白龙云庭", subtitle: "给每一个小进展一点光", image: "/themes/pearl-dragon.png", alt: "原创白发小龙女孩，抱着薄荷色手账向你挥手" }
];

export function parseAppearance(raw) {
  try { return normalizeAppearance(JSON.parse(raw)); }
  catch { return normalizeAppearance(null); }
}
