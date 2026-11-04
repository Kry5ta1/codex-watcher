"use client";

import { THEME_OPTIONS } from "../../lib/themes.js";
import { useAppearance } from "./ThemeProvider.jsx";

export default function CompanionTheme({ compact = false }) {
  const { appearance, changeAppearance, ready, saveError } = useAppearance();
  const theme = THEME_OPTIONS.find((option) => option.id === appearance.theme);
  return (
    <section className={`companionTheme${compact ? " compact" : ""}`} aria-label="界面主题">
      <div className="themeToolbar">
        <div className="themeChoices" role="group" aria-label="选择主题">
          {THEME_OPTIONS.map((option) => (
            <button key={option.id} type="button" disabled={!ready} aria-pressed={appearance.theme === option.id}
              aria-label={`${option.name}主题`} title={option.name}
              onClick={() => changeAppearance({ ...appearance, theme: option.id })}>
              <i className={`themeSwatch ${option.id}`} aria-hidden="true" />{option.label}
            </button>
          ))}
        </div>
        <button className="themeFocus" type="button" disabled={!ready} aria-pressed={appearance.focusMode}
          title="隐藏角色装饰，保留配色与全部功能"
          onClick={() => changeAppearance({ ...appearance, focusMode: !appearance.focusMode })}>
          专注
        </button>
      </div>
      {theme.image && !appearance.focusMode ? (
        <div className="companionBanner">
          <div className="companionCopy">
            <span className="companionEyebrow">YOUR LITTLE COMPANION</span>
            <h2>{theme.name}</h2>
            <p>{theme.subtitle}</p>
            <span className="companionNote">陪你专注每一小步</span>
          </div>
          <div className="companionPortrait">
            <span className="companionHalo" aria-hidden="true" />
            <img src={theme.image} alt={theme.alt} width="180" height="200" draggable="false" />
          </div>
          <span className="companionSpark one" aria-hidden="true">✧</span>
          <span className="companionSpark two" aria-hidden="true">✧</span>
        </div>
      ) : null}
      {saveError ? <p className="themeSaveError" role="status">外观设置未能永久保存，当前界面仍可使用。</p> : null}
    </section>
  );
}

export function ClassicArtwork() {
  const { appearance } = useAppearance();
  return appearance.theme === "classic" && !appearance.focusMode
    ? <img className="summaryArt" src="/usage-header.png" alt="Codex Watcher 插图" />
    : null;
}
