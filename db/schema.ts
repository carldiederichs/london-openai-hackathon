import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";
export const games = sqliteTable("feral_games", {
  code: text("code").primaryKey(),
  snapshot: text("snapshot").notNull(),
  lease: text("lease").notNull().default(""),
  leaseUntil: integer("lease_until").notNull().default(0),
  updated: integer("updated").notNull(),
});
export const sessions = sqliteTable(
  "feral_sessions",
  {
    room: text("room").notNull(),
    token: text("token").notNull(),
    session: text("session").notNull(),
    view: text("view").notNull(),
    input: text("input"),
    seq: integer("seq").notNull().default(-1),
    seen: integer("seen").notNull(),
  },
  (t) => [primaryKey({ columns: [t.room, t.token] })],
);
export const images = sqliteTable(
  "feral_images",
  {
    room: text("room").notNull(),
    id: text("id").notNull(),
    data: text("data").notNull(),
  },
  (t) => [primaryKey({ columns: [t.room, t.id] })],
);
