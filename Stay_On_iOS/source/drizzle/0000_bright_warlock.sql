CREATE TABLE `game_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`event_name` text NOT NULL,
	`run_number` integer,
	`distance_metres` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tester_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visitor_id` text NOT NULL,
	`reason` text NOT NULL,
	`note` text,
	`distance_metres` integer,
	`created_at` text NOT NULL
);
