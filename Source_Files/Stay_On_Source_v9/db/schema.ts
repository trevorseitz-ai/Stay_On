import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gameEvents = sqliteTable("game_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorId: text("visitor_id").notNull(),
  eventName: text("event_name").notNull(),
  runNumber: integer("run_number"),
  distanceMetres: integer("distance_metres"),
  createdAt: text("created_at").notNull(),
});

export const testerFeedback = sqliteTable("tester_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitorId: text("visitor_id").notNull(),
  reason: text("reason").notNull(),
  note: text("note"),
  distanceMetres: integer("distance_metres"),
  createdAt: text("created_at").notNull(),
});
