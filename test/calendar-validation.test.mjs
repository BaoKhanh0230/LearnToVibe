import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCalendarEvent } from "../scripts/calendar-validation.mjs";
import { buildCalendarEvent, calendarEventId } from "../src/calendar.js";

const session = { id: "study", title: "Buổi học", startedAt: "2026-10-14T03:00:00Z", minutes: 30 };
const event = async () => ({ ...buildCalendarEvent(session, "planned"), id: await calendarEventId(session.id, "planned") });

test("server chấp nhận dữ liệu thật của form lịch, chỉ giữ các trường app cần", async () => {
  const body = await event();
  body.attendees = [{ email: "unwanted@example.com" }];
  body.extendedProperties.private.secret = "unwanted";
  body.reminders.overrides[0].extra = "unwanted";
  const saved = normalizeCalendarEvent(body, "POST");
  assert.equal(saved.id, body.id);
  assert.equal(saved.extendedProperties.private.vibelogKind, "planned");
  assert.equal(saved.reminders.overrides[0].minutes, 10);
  assert.equal(JSON.stringify(saved).includes("unwanted"), false);
  assert.equal("id" in normalizeCalendarEvent(body, "PATCH"), false);
});

test("API từ chối thời gian/kiểu dữ liệu sai, duration ngược và reminder ngoài phạm vi", async () => {
  const valid = await event();
  const bad = [null, [], { ...valid, summary: " " }, { ...valid, start: { dateTime: {} } },
    { ...valid, start: { dateTime: "tomorrow" } }, { ...valid, end: valid.start },
    { ...valid, start: { dateTime: "2026-02-30T03:00:00Z" }, end: { dateTime: "2026-02-30T03:30:00Z" } },
    { ...valid, end: { dateTime: "2026-10-15T03:00:00Z" } },
    { ...valid, extendedProperties: { private: { vibelogId: {} } } },
    { ...valid, extendedProperties: { private: { vibelogId: "id", vibelogKind: "other" } } },
    { ...valid, reminders: { useDefault: "false" } },
    { ...valid, reminders: { useDefault: false, overrides: [{ method: "email", minutes: 10 }] } },
    { ...valid, reminders: { useDefault: false, overrides: [{ method: "popup", minutes: -1 }] } },
    { ...valid, reminders: { useDefault: false, overrides: [{ method: "popup", minutes: "10" }] } },
    { ...valid, id: "external-event" }];
  for (const body of bad) assert.throws(() => normalizeCalendarEvent(body, "POST"), error => error.status === 400);
});
