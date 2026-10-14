const invalid = () => { throw Object.assign(new Error("Dữ liệu sự kiện không hợp lệ."), { status: 400 }); };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value, maximum) => typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
const timestamp = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().startsWith(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24;
};

// Validate on the server too: browser forms can be bypassed by direct API calls.
export function normalizeCalendarEvent(body, method) {
  if (!object(body) || !text(body.summary, 200) || !object(body.start) || !object(body.end)
    || !timestamp(body.start.dateTime) || !timestamp(body.end.dateTime)) invalid();
  const minutes = (Date.parse(body.end.dateTime) - Date.parse(body.start.dateTime)) / 60000;
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 600) invalid();
  const properties = body.extendedProperties?.private;
  if (!object(properties) || !text(properties.vibelogId, 128)
    || (properties.vibelogKind !== undefined && !["learned", "planned"].includes(properties.vibelogKind))) invalid();
  if (method === "POST" && !/^vibelog[0-9a-f]{64}$/.test(body.id ?? "")) invalid();
  let reminders;
  if (body.reminders !== undefined) {
    if (!object(body.reminders) || typeof body.reminders.useDefault !== "boolean") invalid();
    reminders = { useDefault: body.reminders.useDefault };
    if (!reminders.useDefault && body.reminders.overrides !== undefined) {
      const values = body.reminders.overrides;
      if (!Array.isArray(values) || values.length > 5 || values.some(value => !object(value)
        || value.method !== "popup" || !Number.isInteger(value.minutes) || value.minutes < 0 || value.minutes > 10080)) invalid();
      reminders.overrides = values.map(({ method, minutes }) => ({ method, minutes }));
    }
  }
  return {
    ...(method === "POST" ? { id: body.id } : {}), summary: body.summary.trim(),
    description: typeof body.description === "string" ? body.description.slice(0, 10000) : "",
    start: { dateTime: body.start.dateTime }, end: { dateTime: body.end.dateTime },
    extendedProperties: { private: { vibelogId: properties.vibelogId,
      ...(properties.vibelogKind === undefined ? {} : { vibelogKind: properties.vibelogKind }) } },
    ...(reminders === undefined ? {} : { reminders }),
  };
}
