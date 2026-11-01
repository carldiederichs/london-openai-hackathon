import {
  sqliteTable,
  index,
  text,
  real,
  integer,
} from "drizzle-orm/sqlite-core";
export const worldPlayers = sqliteTable(
  "world_players",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    pet: text("pet").notNull(),
    image: text("image"),
    x: real("x").notNull(),
    z: real("z").notNull(),
    mask: integer("mask").notNull().default(0),
    sequence: real("sequence").notNull().default(-1),
    changedAt: real("changed_at").notNull(),
    seen: real("seen").notNull(),
  },
  (table) => [index("world_players_seen_idx").on(table.seen)],
);
