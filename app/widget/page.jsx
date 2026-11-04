"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { expiryInfo, relativeChecked } from "../../lib/widget.js";

import CompanionTheme from "../components/CompanionTheme.jsx";
import AnnouncementClock from "../components/AnnouncementClock.jsx";

import { useAppearance } from "../components/ThemeProvider.jsx";
import useWidgetLayout from "../hooks/useWidgetLayout.js";
import { themeTransparency } from "../../lib/themes.js";

export default function Widget() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const { appearance } = useAppearance();
  const transparency = themeTransparency(appearance.theme);
  const [now, setNow] = useState(() => new Date());
  const toastTimer = useRef(null);
  const { shellRef, shellStyle } = useWidgetLayout();

  async function refresh({ notify = false } = {}) {
    setLoading(true);
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "无法刷新状态。");
      }
      setStatus(payload);
      setNow(new Date());
      setRequestError(null);
      if (notify) {
        setToast("更新成功");
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(null), 1800);
      }
    } catch (error) {
      setRequestError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.body.classList.add("widgetBody");
    refresh();
    const refreshTimer = setInterval(refresh, 5 * 60 * 1000);
    const clockTimer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => {
      document.body.classList.remove("widgetBody");
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
      clearTimeout(toastTimer.current);
    };
  }, []);

  const errors = useMemo(
    () => [requestError, ...(status?.errors ?? [])].filter(Boolean),
    [requestError, status]
  );
  const usageWindows = status?.windows ?? [];
  const meterWindows = usageWindows.length > 0 ? usageWindows : [null];
  const credits = status?.credits ?? [];
  const expiringCredits = credits.filter((credit) => credit.isAvailable).slice(0, 3);
  const opacity = 1 - transparency / 100;

  return (
    <div className="widgetViewport">
    <main className="widgetShell" ref={shellRef} style={shellStyle}>
      <section
        className={`widgetCard ${status?.nudge?.tier ?? "loading"}`}
        style={{ "--widget-alpha": opacity }}
      >
        <header className="widgetHeader">
          <div className="widgetBrand">
            <img src="/app-icon.png" alt="" />
            <div className="widgetBrandCopy">
              <span>Codex Watcher</span>
              <div className="widgetTitleLine">
                <strong>{status?.planLabel ?? "Codex"} 订阅</strong>
                <small>{relativeChecked(status?.lastChecked, now)}</small>
              </div>
            </div>
          </div>
          <div className="widgetHeaderActions">
            {toast ? <div className="widgetToast">{toast}</div> : null}
            <button
              aria-label="打开设置"
              className="widgetSettingsButton"
              onClick={() => setSettingsOpen((current) => !current)}
              type="button"
            >
              &#9881;
            </button>
            <button
              aria-label="刷新数据"
              className="widgetRefresh"
              disabled={loading}
              onClick={() => refresh({ notify: true })}
              type="button"
            >
              &#8635;
            </button>
          </div>
        </header>

        <CompanionTheme compact />

        <AnnouncementClock compact />

        <div
          className={`widgetMeters ${meterWindows.length <= 1 ? "single" : ""}`}
          aria-label="使用额度"
        >
          {meterWindows.map((limit, index) => (
            <WidgetMeter
              key={limit ? `${limit.id}-${index}` : `empty-${index}`}
              label={windowMark(limit?.kind)}
              limit={limit}
              title={limit?.title ?? (loading ? "额度窗口" : "暂无额度窗口")}
            />
          ))}
        </div>

        <article className="widgetNudge">
          <p>{status?.nudge?.message ?? "额度数据回来后会给出使用判断。"}</p>
        </article>

        <section className="widgetResetTop">
          <div className="widgetHero">
            <span>当前可用重置</span>
            <strong>{loading && !status ? "读取中" : `${status?.availableCount ?? 0} 个`}</strong>
          </div>

          <section className="widgetTickets" aria-label="重置 ticket 到期时间">
            <header>
              <span>最快到期 ticket</span>
              <strong>最多显示 3 条</strong>
            </header>
            {expiringCredits.length === 0 ? (
              <p className="widgetTicketEmpty">暂无可用重置 ticket</p>
            ) : (
              <div className="widgetTicketList">
                {expiringCredits.map((credit) => {
                  const expiry = expiryInfo(credit.expiresAt);
                  return (
                    <article
                      className={`widgetTicket ${credit.urgency.level}`}
                      key={credit.id}
                    >
                      <span className="widgetTicketBadge">
                        {credit.urgency.badge}
                      </span>
                      <strong>{expiry.text}</strong>
                      {expiry.useSoon ? (
                        <span className="widgetTicketAction">尽快使用</span>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>

        {errors.length > 0 ? (
          <div className="widgetError" aria-live="polite">
            <strong>!</strong>
            <span>{errors[0]}</span>
          </div>
        ) : null}

        {settingsOpen ? (
          <section className="widgetSettingsPanel" aria-label="卡片设置">
            <header>
              <strong>设置</strong>
              <button
                aria-label="关闭设置"
                className="widgetSettingsClose"
                onClick={() => setSettingsOpen(false)}
                type="button"
              >
                &#215;
              </button>
            </header>
            <div className="widgetOpacityControl">
              <span>当前主题背景透明度</span>
              <strong>{transparency}%</strong>
            </div>
            <p className="widgetSettingsHint">经典 15% · 深海 10% · 白龙 0%<br />透明度随主题切换，文字保持清晰。</p>

          </section>
        ) : null}
      </section>
    </main>
    </div>
  );
}

function WidgetMeter({ label, limit, title }) {
  const hasRemaining = Number.isFinite(limit?.remainingPercent);
  const remaining = hasRemaining
    ? Math.max(0, Math.min(100, limit.remainingPercent))
    : 0;
  const tone = !hasRemaining
    ? "unknown"
    : remaining <= 15
      ? "low"
      : remaining <= 30
        ? "warn"
        : "ok";

  return (
    <article className={`widgetMeter ${tone}`}>
      <header>
        <span>{label}</span>
        <div>
          <strong>{title}</strong>
          <small>{limit?.resetIn ?? "-"}</small>
        </div>
      </header>
      <div className="widgetMeterLine">
        <strong>{percent(limit?.remainingPercent)}</strong>
        <span>剩余</span>
      </div>
      <div className="widgetTrack" aria-hidden="true">
        <div style={{ width: `${remaining}%` }} />
      </div>
    </article>
  );
}

function windowMark(kind) {
  if (kind === "short") {
    return "5H";
  }
  if (kind === "weekly") {
    return "W";
  }
  return "-";
}

function percent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "-";
}
