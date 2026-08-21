const createEvents = `CREATE TABLE IF NOT EXISTS game_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  run_number INTEGER,
  distance_metres INTEGER,
  created_at TEXT NOT NULL
)`;

const createFeedback = `CREATE TABLE IF NOT EXISTS tester_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT,
  distance_metres INTEGER,
  created_at TEXT NOT NULL
)`;

async function getD1() {
  const { env } = await import("cloudflare:workers");
  return env.DB;
}

async function ensureTables(d1: Awaited<ReturnType<typeof getD1>>) {
  await d1.batch([
    d1.prepare(createEvents),
    d1.prepare(createFeedback),
    d1.prepare(
      "CREATE INDEX IF NOT EXISTS game_events_visitor_idx ON game_events (visitor_id)"
    ),
  ]);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 80) : "";
    if (!visitorId) return Response.json({ ok: false }, { status: 400 });

    const d1 = await getD1();
    await ensureTables(d1);
    const now = new Date().toISOString();

    if (body.kind === "feedback") {
      const reason = typeof body.reason === "string" ? body.reason.slice(0, 80) : "";
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 600) : "";
      if (!reason) return Response.json({ ok: false }, { status: 400 });
      await d1.prepare(
        "INSERT INTO tester_feedback (visitor_id, reason, note, distance_metres, created_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(visitorId, reason, note || null, Number(body.distanceMetres) || 0, now)
        .run();
    } else {
      const eventName = typeof body.eventName === "string" ? body.eventName.slice(0, 40) : "";
      if (!eventName) return Response.json({ ok: false }, { status: 400 });
      await d1.prepare(
        "INSERT INTO game_events (visitor_id, event_name, run_number, distance_metres, created_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(
          visitorId,
          eventName,
          Number(body.runNumber) || null,
          Number(body.distanceMetres) || null,
          now
        )
        .run();
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
