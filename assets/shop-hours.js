export function shopStatus(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = !["Saturday", "Sunday"].includes(parts.weekday);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const open = weekday && minutes >= 480 && minutes < 1020;
  return {
    open,
    day: parts.weekday,
    label: open
      ? "Open today until 5 p.m."
      : weekday && minutes < 480
        ? "Closed · Opens today at 8 a.m."
        : parts.weekday === "Friday" ||
            parts.weekday === "Saturday" ||
            parts.weekday === "Sunday"
          ? "Closed · Opens Monday at 8 a.m."
          : "Closed · Opens tomorrow at 8 a.m.",
  };
}
