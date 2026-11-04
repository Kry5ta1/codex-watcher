"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { APPEARANCE_KEY, normalizeAppearance, parseAppearance } from "../../lib/themes.js";

const AppearanceContext = createContext(null);

export default function ThemeProvider({ children }) {
  const [appearance, setAppearance] = useState(() => normalizeAppearance(null));
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    let timeout;
    const startingRevision = revision.current;
    try { setAppearance(parseAppearance(window.localStorage.getItem(APPEARANCE_KEY))); } catch {}
    async function initialize() {
      try {
        if (window.codexWidget?.getAppearance) {
          // Allow interaction after a slow IPC read, but still apply its eventual
          // result unless the user has made a newer choice in the meantime.
          timeout = setTimeout(() => { if (active) setReady(true); }, 1500);
          const saved = await window.codexWidget.getAppearance();
          if (active && saved && revision.current === startingRevision) setAppearance(normalizeAppearance(saved));
        }
      } catch {} finally {
        clearTimeout(timeout);
        if (active) setReady(true);
      }
    }
    initialize();
    const sync = (event) => {
      if (!window.codexWidget && event.key === APPEARANCE_KEY) {
        revision.current += 1;
        setAppearance(parseAppearance(event.newValue));
      }
    };
    window.addEventListener("storage", sync);
    return () => { active = false; clearTimeout(timeout); window.removeEventListener("storage", sync); };
  }, []);

  function changeAppearance(value) {
    const next = normalizeAppearance(value);
    const currentRevision = ++revision.current;
    setAppearance(next);
    setSaveError(false);
    let localSaved = false;
    try { window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)); localSaved = true; } catch {}
    if (window.codexWidget?.setAppearance) {
      window.codexWidget.setAppearance(next).catch(() => {
        if (revision.current === currentRevision) setSaveError(true);
      });
    } else if (!localSaved) setSaveError(true);
  }

  return (
    <AppearanceContext.Provider value={{ appearance, changeAppearance, ready, saveError }}>
      <div className="watcherTheme" data-theme={appearance.theme} data-focus={appearance.focusMode ? "true" : "false"}>
        {children}
      </div>
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}
