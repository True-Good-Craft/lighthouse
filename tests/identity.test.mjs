import test from "node:test";
import assert from "node:assert/strict";

import {
  parseCanonicalPageviewPayload,
  summarizeIdentity,
  normalizeOptionalAnonymousId,
  coerceBooleanLikeToInt,
} from "../dist/index.js";

function basePayload(overrides = {}) {
  return {
    type: "pageview",
    client_ts: "2026-03-26T12:00:00.000Z",
    path: "/",
    url: "https://buscore.ca/",
    referrer: "",
    device: "desktop",
    viewport: "1920x1080",
    lang: "en-CA",
    tz: "America/Toronto",
    utm: {},
    ...overrides,
  };
}

test("old payload without identity fields still parses", () => {
  const parsed = parseCanonicalPageviewPayload(basePayload());
  assert.ok(parsed);
  assert.equal(parsed.anon_user_id, null);
  assert.equal(parsed.session_id, null);
  assert.equal(parsed.is_new_user, 0);
});

test("new payload with identity fields parses and coerces", () => {
  const parsed = parseCanonicalPageviewPayload(
    basePayload({
      anon_user_id: "A0Eebc99-9c0B-4ef8-Bb6d-6Bb9Bd380a11",
      session_id: "1eebc999-9c0b-4ef8-bb6d-6bb9bd380a11",
      is_new_user: "true",
      src: "hn_test_1",
    })
  );

  assert.ok(parsed);
  assert.equal(parsed.anon_user_id, "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
  assert.equal(parsed.session_id, "1eebc999-9c0b-4ef8-bb6d-6bb9bd380a11");
  assert.equal(parsed.is_new_user, 1);
});

test("malformed identity fields are nulled and do not invalidate payload", () => {
  const parsed = parseCanonicalPageviewPayload(
    basePayload({
      anon_user_id: "not-a-uuid",
      session_id: "also-bad",
      is_new_user: "not-a-bool",
    })
  );

  assert.ok(parsed);
  assert.equal(parsed.anon_user_id, null);
  assert.equal(parsed.session_id, null);
  assert.equal(parsed.is_new_user, 0);
});

test("identity helpers coerce expected values", () => {
  assert.equal(
    normalizeOptionalAnonymousId("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"),
    "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
  );
  assert.equal(normalizeOptionalAnonymousId("bad"), null);
  assert.equal(coerceBooleanLikeToInt(true), 1);
  assert.equal(coerceBooleanLikeToInt("1"), 1);
  assert.equal(coerceBooleanLikeToInt("false"), 0);
});

test("summarizeIdentity computes returning users, sessions, and source quality", () => {
  const today = "2026-03-26";
  const start = "2026-03-20";

  const events = [
    { received_day: "2026-03-24", anon_user_id: "u-a", session_id: "s-a-1", is_new_user: 1, src: "hn_test_1", utm_source: null },
    { received_day: "2026-03-26", anon_user_id: "u-a", session_id: "s-a-1", is_new_user: 0, src: null, utm_source: null },
    { received_day: "2026-03-26", anon_user_id: "u-a", session_id: "s-a-2", is_new_user: 0, src: null, utm_source: null },
    { received_day: "2026-03-25", anon_user_id: "u-b", session_id: "s-b-1", is_new_user: 1, src: "github", utm_source: null },
    { received_day: "2026-03-26", anon_user_id: null, session_id: null, is_new_user: 0, src: null, utm_source: null },
  ];

  const firstSeen = new Map([
    ["u-a", "2026-03-24"],
    ["u-b", "2026-03-25"],
  ]);

  const summary = summarizeIdentity(events, firstSeen, today, start, 5);

  assert.deepEqual(summary.today, {
    new_users: 0,
    returning_users: 1,
    sessions: 2,
  });

  assert.equal(summary.last_7_days.new_users, 2);
  assert.equal(summary.last_7_days.returning_users, 1);
  assert.equal(summary.last_7_days.sessions, 3);
  assert.equal(summary.last_7_days.return_rate, 0.5);
  assert.deepEqual(summary.top_sources_by_returning_users, [
    { source: "(direct)", users: 1 },
    { source: "hn_test_1", users: 1 },
  ]);
});
