"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clampTransparency, expiryInfo, relativeChecked } from "../../lib/widget.js";

const TRANSPARENCY_KEY = "codex-widget-transparency";

export default function Widget() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [transparency, setTransparency] = useState(18);
  const [now, setNow] = useState(() => new Date());
  const toastTimer = useRef(null);

  function applyTransparency(value) {
    const nextTransparency = clampTransparency(value);
    setTransparency(nextTransparency);
    setLocalTransparency(nextTransparency);
    return nextTransparency;
  }

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
    let ignoreTransparency = false;
    const stopWatchingTransparency = window.codexWidget?.onTransparencyChanged?.(
      (value) => applyTransparency(value)
    );

    async function loadTransparency() {
      const electronTransparency = await window.codexWidget?.getTransparency?.();
      if (ignoreTransparency) {
        return;
      }
      if (electronTransparency !== null && electronTransparency !== undefined) {
        applyTransparency(electronTransparency);
        return;
      }

      const localTransparency = readLocalTransparency();
      if (localTransparency !== null) {
        applyTransparency(localTransparency);
        await window.codexWidget?.setTransparency?.(localTransparency);
      }
    }

    loadTransparency().catch(() => {});
    refresh();
    const refreshTimer = setInterval(refresh, 5 * 60 * 1000);
    const clockTimer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => {
      ignoreTransparency = true;
      stopWatchingTransparency?.();
      document.body.classList.remove("widgetBody");
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
      clearTimeout(toastTimer.current);
    };
  }, []);

  function changeTransparency(event) {
    const nextTransparency = applyTransparency(event.target.value);
    window.codexWidget?.setTransparency?.(nextTransparency)?.catch?.(() => {});
  }

  const errors = useMemo(
    () => [requestError, ...(status?.errors ?? [])].filter(Boolean),
    [requestError, status]
  );
  const fiveHour = status?.windows?.find((item) => item.kind === "fiveHour");
  const weekly = status?.windows?.find((item) => item.kind === "weekly");
  const credits = status?.credits ?? [];
  const expiringCredits = credits.filter((credit) => credit.isAvailable).slice(0, 3);
  const opacity = 1 - transparency / 100;

  return (
    <main className="widgetShell">
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

        <div className="widgetMeters" aria-label="使用额度">
          <WidgetMeter label="5h" limit={fiveHour} title="5 小时额度" />
          <WidgetMeter label="W" limit={weekly} title="每周额度" />
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
            <label className="widgetOpacityControl">
              <span>透明度</span>
              <strong>{Math.round(transparency)}%</strong>
              <input
                aria-label="调整透明度"
                max="100"
                min="0"
                onChange={changeTransparency}
                step="1"
                type="range"
                value={transparency}
              />
            </label>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function WidgetMeter({ label, limit, title }) {
  const remaining = Number.isFinite(limit?.remainingPercent)
    ? Math.max(0, Math.min(100, limit.remainingPercent))
    : 0;
  const tone = remaining <= 15 ? "low" : remaining <= 30 ? "warn" : "ok";

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

function percent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "-";
}

function setLocalTransparency(value) {
  try {
    window.localStorage.setItem(TRANSPARENCY_KEY, String(value));
  } catch {}
}

function readLocalTransparency() {
  try {
    const value = window.localStorage.getItem(TRANSPARENCY_KEY);
    if (value === null) {
      return null;
    }
    const number = Number(value);
    return clampTransparency(number > 0 && number <= 1 ? number * 100 : number);
  } catch {
    return null;
  }
}
