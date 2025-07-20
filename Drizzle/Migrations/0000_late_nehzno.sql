    -- {
    --   "idx": 2,
    --   "version": "5",
    --   "when": 1752991155393,
    --   "tag": "0000_late_nehzno",
    --   "breakpoints": true
    -- },

CREATE TABLE `tbl_ai_response` (
	`id` int NOT NULL,
	`role` varchar(255),
	`prompt` longtext NOT NULL,
	`answer` longtext NOT NULL,
	`type` enum('Address','Education','Experience','Portfolio','Awards','Skills') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tbl_ai_response_id` PRIMARY KEY(`id`),
	CONSTRAINT `tbl_ai_response_role_unique` UNIQUE(`role`)
);
