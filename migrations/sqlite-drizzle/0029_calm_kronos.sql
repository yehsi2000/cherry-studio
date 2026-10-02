ALTER TABLE `topic` ADD `source` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `topic_source_idx` ON `topic` (`source`);