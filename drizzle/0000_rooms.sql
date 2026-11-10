CREATE TABLE `poker_rooms` (
  `id` text PRIMARY KEY NOT NULL,
  `state` text NOT NULL,
  `version` integer DEFAULT 0 NOT NULL,
  `updated_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rooms_expiry_idx` ON `poker_rooms` (`expires_at`);
