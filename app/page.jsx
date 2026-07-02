"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { expiryInfo, relativeChecked } from "../lib/widget.js";

export default function Home() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [requestError, setRequestError] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

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
    refresh();
    const refreshTimer = setInterval(refresh, 5 * 60 * 1000);
    const clockTimer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(clockTimer);
      clearTimeout(toastTimer.current);
    };
  }, []);

  const errors = useMemo(
    () => [requestError, ...(status?.errors ?? [])].filter(Boolean),
    [requestError, status]
  );

  return (
    <main className="dashboard">
      <aside className="summaryPane">
        <div className="brandBlock">
          <img src="/app-icon.png" alt="" />
          <div>
            <h1>Codex Watcher</h1>
            <small>
              {status?.planLabel ?? "Codex"} 订阅 ·{" "}
              {relativeChecked(status?.lastChecked, now)}
            </small>
          </div>
        </div>

        <img
          className="summaryArt"
          src="/usage-header.png"
          alt="Codex Watcher 插图"
        />

        <section className="resetHero">
          <span>当前可用</span>
          <strong>{status?.availableCount ?? 0}</strong>
          <p>个重置额度</p>
        </section>

        <NudgeCard nudge={status?.nudge} loading={loading && !status} />

        <dl className="syncList">
          <div>
            <dt>账户</dt>
            <dd>{status?.planLabel ?? "Codex"}</dd>
          </div>
          <div>
            <dt>自动刷新</dt>
            <dd>页面打开时每 5 分钟</dd>
          </div>
        </dl>

        <div className="refreshStack">
          {toast ? <div className="webToast">{toast}</div> : null}
          <button
            className="refreshButton"
            onClick={() => refresh({ notify: true })}
            disabled={loading}
            type="button"
          >
            <span aria-hidden="true">&#8635;</span>
            {loading ? "刷新中" : "刷新数据"}
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspaceHeader">
          <div>
            <span>只读监控</span>
            <h2>Codex 使用额度</h2>
          </div>
          <p>读取本机 Codex 登录状态，只展示额度，不会兑换重置。</p>
        </header>

        {errors.length > 0 ? (
          <section className="errorStack" aria-live="polite">
            {errors.map((message) => (
              <div className="banner" key={message}>
                <span aria-hidden="true">!</span>
                <p>{message}</p>
              </div>
            ))}
          </section>
        ) : null}

        {!status && loading ? (
          <LoadingState />
        ) : (
          <>
            <section className="meterGrid" aria-label="使用额度">
              {(status?.windows ?? []).map((window) => (
                <UsageCard window={window} key={window.id} />
              ))}
              {(status?.windows?.length ?? 0) === 0 ? (
                <EmptyPanel
                  title="还没有额度窗口"
                  text="等待 Codex 返回 5 小时和每周额度。"
                />
              ) : null}
            </section>

            <section className="resetPanel">
              <header>
                <div>
                  <span>到期队列</span>
                  <h3>储备重置</h3>
                </div>
                <strong>{status?.availableCount ?? 0} 个可用</strong>
              </header>

              {(status?.credits?.length ?? 0) === 0 ? (
                <EmptyPanel
                  title="当前没有储备的重置额度"
                  text="Codex 已响应，但重置额度为空。"
                />
              ) : (
                <div className="creditTable">
                  <div className="tableHead" aria-hidden="true">
                    <span>编号</span>
                    <span>额度</span>
                    <span>状态</span>
                    <span>到期</span>
                    <span>提示</span>
                  </div>
                  {status.credits.map((credit, index) => (
                    <CreditRow credit={credit} index={index} key={credit.id} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <>
      <section className="meterGrid" aria-label="加载中的使用额度">
        <SkeletonUsageCard title="5 小时额度" mark="5h" />
        <SkeletonUsageCard title="每周额度" mark="周" />
      </section>
      <section className="resetPanel">
        <header>
          <div>
            <span>到期队列</span>
            <h3>储备重置</h3>
          </div>
          <strong>读取中</strong>
        </header>
        <div className="loadingPanel">
          <img src="/app-icon.png" alt="" />
          <strong>正在检查 Codex 额度</strong>
          <span>正在获取重置额度和使用窗口。</span>
        </div>
      </section>
    </>
  );
}

function SkeletonUsageCard({ title, mark }) {
  return (
    <article className="usageCard skeletonCard">
      <header>
        <span className="metricMark">{mark}</span>
        <div>
          <strong>{title}</strong>
          <span>等待同步</span>
        </div>
      </header>
      <div className="percentLine">
        <strong>--</strong>
        <span>剩余</span>
      </div>
      <div className="meterTrack" aria-hidden="true">
        <div className="meter" style={{ width: "38%" }} />
      </div>
      <dl className="usageFacts">
        <div>
          <dt>已用</dt>
          <dd>-</dd>
        </div>
        <div>
          <dt>重置倒计时</dt>
          <dd>-</dd>
        </div>
        <div>
          <dt>重置时间</dt>
          <dd>-</dd>
        </div>
      </dl>
    </article>
  );
}

function EmptyPanel({ title, text }) {
  return (
    <div className="emptyPanel">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function CreditRow({ credit, index }) {
  const expiry = expiryInfo(credit.expiresAt);

  return (
    <article className={`creditRow ${credit.urgency.level}`}>
      <span className="rowIndex">{index + 1}</span>
      <div className="creditCopy">
        <strong>{credit.title}</strong>
        {credit.urgency.hint ? <span>{credit.urgency.hint}</span> : null}
      </div>
      <div className="creditStatus">
        <span className="badge">{credit.urgency.badge}</span>
      </div>
      <div className="creditDue">
        <span>到期</span>
        <strong>{expiry.text}</strong>
      </div>
      <div className="creditPrompt">
        {expiry.useSoon ? (
          <span className="useSoonBadge">尽快使用</span>
        ) : (
          <span className="creditPromptMuted">-</span>
        )}
      </div>
    </article>
  );
}

function NudgeCard({ nudge, loading }) {
  if (!nudge) {
    return (
      <article className="nudgeCard muted">
        <span className="nudgeIcon" aria-hidden="true">
          ...
        </span>
        <div>
          <strong>{loading ? "正在读取建议" : "暂无建议"}</strong>
          <p>{loading ? "额度数据回来后会给出使用判断。" : "刷新后再查看额度状态。"}</p>
        </div>
      </article>
    );
  }

  return (
    <article className={`nudgeCard ${nudge.tier}`}>
      <span className="nudgeIcon" aria-hidden="true">
        {iconForNudge(nudge.tier)}
      </span>
      <div>
        <header>
          <strong>{nudge.title}</strong>
        </header>
        <p>{nudge.message}</p>
      </div>
    </article>
  );
}

function UsageCard({ window }) {
  const remaining = Number.isFinite(window.remainingPercent)
    ? Math.max(0, Math.min(100, window.remainingPercent))
    : 0;
  const tone = remaining <= 15 ? "low" : remaining <= 30 ? "warn" : "ok";

  return (
    <article className={`usageCard ${tone}`}>
      <header>
        <span className="metricMark">{window.kind === "weekly" ? "W" : "5h"}</span>
        <div>
          <strong>{window.title}</strong>
          <span>剩余额度</span>
        </div>
      </header>
      <div className="percentLine">
        <strong>{percent(window.remainingPercent)}</strong>
        <span>剩余</span>
      </div>
      <div className="meterTrack" aria-hidden="true">
        <div className="meter" style={{ width: `${remaining}%` }} />
      </div>
      <dl className="usageFacts">
        <div>
          <dt>已用</dt>
          <dd>{percent(window.usedPercent)}</dd>
        </div>
        <div>
          <dt>重置倒计时</dt>
          <dd>{window.resetIn}</dd>
        </div>
        <div>
          <dt>重置时间</dt>
          <dd>{formatDate(window.resetAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatDate(value, includeDate = false) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: includeDate ? "medium" : undefined,
    timeStyle: "short"
  }).format(date);
}

function percent(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "-";
}

function iconForNudge(tier) {
  if (tier === "hold" || tier === "waitFiveHour") {
    return "-";
  }
  if (tier === "steady") {
    return "=";
  }
  if (tier === "noResets" || tier === "unavailable") {
    return "?";
  }
  return "!";
}
