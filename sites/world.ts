import {
  SharedWorld,
  WORLD_BOUNDS,
  MANSION,
  type WorldPet,
  type WorldState,
} from "../src/world/engine";
export type Row = {
  id: string;
  token: string;
  pet: string;
  image: string | null;
  x: number;
  z: number;
  mask: number;
  sequence: number;
  changed_at: number;
  seen: number;
};
export function project(row: Row, now: number): WorldPet {
  const pet = JSON.parse(row.pet) as WorldPet;
  const dx = Number(!!(row.mask & 2)) - Number(!!(row.mask & 8)),
    dz = Number(!!(row.mask & 4)) - Number(!!(row.mask & 1));
  const length = Math.hypot(dx, dz);
  let x = row.x,
    z = row.z;
  let seconds = Math.max(0, Math.min(now - row.changed_at, 2000)) / 1000;
  const walk = (a: number, b: number) =>
    !(
      a > MANSION.minX &&
      a < MANSION.maxX &&
      b > MANSION.minZ &&
      b < MANSION.maxZ
    );
  while (length && seconds > 0) {
    const distance = (4.2 * Math.min(seconds, 0.05)) / length;
    seconds -= 0.05;
    const a = Math.max(
      WORLD_BOUNDS.minX,
      Math.min(WORLD_BOUNDS.maxX, x + dx * distance),
    );
    if (walk(a, z)) x = a;
    const b = Math.max(
      WORLD_BOUNDS.minZ,
      Math.min(WORLD_BOUNDS.maxZ, z + dz * distance),
    );
    if (walk(x, b)) z = b;
  }
  return {
    ...pet,
    position: { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 },
    moving: !!length && now - row.changed_at < 2000,
    online: now - row.seen < 12000,
  };
}
export function createPlayer(input: unknown, now: number, slot: number) {
  const world = new SharedWorld(now),
    session = world.join(input as any, now);
  const member = world.authenticate(session);
  member.pet.position = {
    x: -9 + (slot % 20) * 0.9,
    z: 9 + Math.floor(slot / 20) * 0.6,
  };
  return {
    session,
    pet: member.pet,
    image: world.images.get(session.playerId) || null,
  };
}
export async function worldApi(request: Request, db: any): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname,
    now = Date.now();
  const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
  const body = async () => {
    const raw = await request.text();
    if (raw.length > 150000) throw new Error("Pet image is too large.");
    return JSON.parse(raw || "{}");
  };
  const auth = async (input: any): Promise<Row> => {
    if (typeof input.playerId !== "string" || typeof input.token !== "string")
      throw new Error("Your session expired. Choose a pet again.");
    const row = await db
      .prepare(
        "SELECT id,token,pet,x,z,mask,sequence,changed_at,seen FROM world_players WHERE id=? AND token=?",
      )
      .bind(input.playerId, input.token)
      .first();
    if (!row || row.seen < now - 180000)
      throw new Error("Your session expired. Choose a pet again.");
    return row;
  };
  const state = async (id?: string): Promise<WorldState> => {
    const counts = await db
      .prepare(
        "SELECT COUNT(*) AS count, COALESCE(SUM(seen>?),0) AS online FROM world_players WHERE seen>?",
      )
      .bind(now - 12000, now - 180000)
      .first();
    const result = id
      ? await db
          .prepare(
            "SELECT id,token,pet,x,z,mask,sequence,changed_at,seen FROM world_players WHERE id=?",
          )
          .bind(id)
          .all()
      : await db
          .prepare(
            "SELECT id,token,pet,x,z,mask,sequence,changed_at,seen FROM world_players WHERE seen>?",
          )
          .bind(now - 180000)
          .all();
    return {
      pets: result.results.map((row: Row) => project(row, now)),
      count: counts.count,
      online: counts.online,
      capacity: 300,
      now,
    };
  };
  try {
    if (path === "/api/health")
      return json({ ok: true, transport: "sites", capacity: 300 });
    if (path === "/api/config") return json({ joinBase: url.origin });
    if (path === "/api/world/join" && request.method === "POST") {
      const input = await body();
      const n = await db
        .prepare("SELECT COUNT(*) AS count FROM world_players WHERE seen>?")
        .bind(now - 180000)
        .first();
      const { session, pet, image } = createPlayer(input, now, n.count);
      // D1 serializes this conditional insert: concurrent joins cannot exceed the cap.
      const result = await db.batch([
        db.prepare("DELETE FROM world_players WHERE seen<?").bind(now - 180000),
        db
          .prepare(
            "INSERT INTO world_players (id,token,pet,image,x,z,mask,sequence,changed_at,seen) SELECT ?,?,?,?,-9+((SELECT COUNT(*) FROM world_players)%20)*0.9,9+((SELECT COUNT(*) FROM world_players)/20)*0.6,0,-1,?,? WHERE (SELECT COUNT(*) FROM world_players)<300",
          )
          .bind(
            session.playerId,
            session.token,
            JSON.stringify(pet),
            image,
            now,
            now,
          ),
      ]);
      if (!result[1].meta.changes)
        return json(
          {
            ok: false,
            error: "The castle has all 300 players. Try again shortly.",
          },
          409,
        );
      return json({ ok: true, data: session });
    }
    if (path === "/api/world/leave" && request.method === "POST") {
      const input = await body();
      await auth(input);
      await db
        .prepare("DELETE FROM world_players WHERE id=? AND token=?")
        .bind(input.playerId, input.token)
        .run();
      return json({ ok: true });
    }
    if (path.startsWith("/api/world/images/")) {
      const row = await db
        .prepare("SELECT image FROM world_players WHERE id=?")
        .bind(path.split("/").pop())
        .first();
      if (!row?.image) return new Response("Not found", { status: 404 });
      const [header, data] = row.image.split(",");
      return new Response(
        Uint8Array.from(atob(data), (c: string) => c.charCodeAt(0)),
        {
          headers: {
            "Content-Type": header.slice(5, header.indexOf(";")),
            "Cache-Control": "public, max-age=3600",
          },
        },
      );
    }
    if (path === "/api/world/state") {
      if (request.method === "POST") {
        const row = await auth(await body());
        return json({ ok: true, data: await state(row.id) });
      }
      return json({ ok: true, data: await state() });
    }
    if (path === "/api/world/input" && request.method === "POST") {
      const input = await body();
      if (
        !Number.isInteger(input.mask) ||
        input.mask < 0 ||
        input.mask > 15 ||
        !Number.isSafeInteger(input.sequence)
      )
        return json({ ok: false, error: "Invalid movement." }, 400);
      for (let attempt = 0; attempt < 4; attempt++) {
        const row = await auth(input);
        if (input.sequence <= row.sequence) break;
        const pet = project(row, now);
        const result = await db
          .prepare(
            "UPDATE world_players SET x=?,z=?,mask=?,sequence=?,changed_at=?,seen=? WHERE id=? AND token=? AND sequence=?",
          )
          .bind(
            pet.position.x,
            pet.position.z,
            input.mask,
            input.sequence,
            now,
            now,
            row.id,
            input.token,
            row.sequence,
          )
          .run();
        if (result.meta.changes) break;
      }
      return json({ ok: true });
    }
    return json(
      { ok: false, error: "This route is not available in the shared castle." },
      404,
    );
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          (error as Error).message ||
          "The castle could not finish that action.",
      },
      400,
    );
  }
}
