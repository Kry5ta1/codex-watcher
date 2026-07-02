export function expiryInfo(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { text: "到期时间未知", useSoon: false };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const remainingMs = date.getTime() - now.getTime();
  if (remainingMs <= 0) {
    return { text: `${formatExpiry(value)}，已到期`, useSoon: false };
  }

  const days = Math.ceil(remainingMs / dayMs);
  return {
    text: `${formatExpiry(value)}，还有${days}天到期`,
    useSoon: remainingMs < 15 * dayMs
  };
}

export function formatExpiry(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "到期时间未知";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function relativeChecked(value, now = new Date()) {
  if (!value) {
    return "尚未同步";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "尚未同步";
  }
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  return `${minutes}min之前`;
}

export function clampTransparency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 18;
  }
  return Math.max(0, Math.min(100, number));
}
