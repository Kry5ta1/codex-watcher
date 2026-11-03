export const ANNOUNCEMENT_TIME_ZONE = "America/Los_Angeles";

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ANNOUNCEMENT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZoneName: "short"
});
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ANNOUNCEMENT_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric"
});
const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ANNOUNCEMENT_TIME_ZONE,
  timeZoneName: "shortOffset"
});

export function formatAnnouncementClock(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(
    clockFormatter.formatToParts(date).map(({ type, value }) => [type, value])
  );
  const offset = offsetFormatter.formatToParts(date)
    .find(({ type }) => type === "timeZoneName").value.replace("GMT", "UTC");
  return {
    time: `${parts.hour}:${parts.minute}`,
    seconds: parts.second,
    period: parts.dayPeriod,
    zone: parts.timeZoneName,
    offset,
    date: dateFormatter.format(date),
    iso: date.toISOString(),
    accessible: `美国太平洋时间 ${dateFormatter.format(date)}, ${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod} ${parts.timeZoneName}`
  };
}
