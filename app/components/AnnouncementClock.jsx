"use client";

import { useEffect, useState } from "react";
import { formatAnnouncementClock } from "../../lib/clock.js";

export default function AnnouncementClock({ compact = false }) {
  // Start with identical server/client markup, then read the device clock after mount.
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, []);
  const clock = formatAnnouncementClock(now);

  return (
    <section className={`announcementClock${compact ? " compact" : ""}`} aria-label="美国太平洋时钟">
      <header className="announcementClockHeader">
        <span className="announcementClockLabel">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6v6l4 2" />
          </svg>
          PACIFIC TIME
        </span>
        <span className="announcementClockZone" title="America/Los_Angeles · 自动切换 PST / PDT">
          {clock?.zone ?? "PT"}<span>{clock?.offset ?? "美国西海岸"}</span>
        </span>
      </header>
      <div className="announcementClockFace">
        <time dateTime={clock?.iso} aria-label={clock?.accessible ?? "正在读取美国太平洋时间"} aria-live="off">
          <span className="announcementClockDigits">{clock?.time ?? "--:--"}</span>
          <span className="announcementClockSeconds" aria-hidden="true">:{clock?.seconds ?? "--"}</span>
          <span className="announcementClockPeriod">{clock?.period ?? "--"}</span>
        </time>
        <div className="announcementClockDate">
          <strong>{clock?.date ?? "—"}</strong>
          <span>美国太平洋时间</span>
        </div>
      </div>
      {!compact ? <p className="announcementClockHint">公告时间参考 · 夏令时自动切换</p> : null}
    </section>
  );
}
