ALTER TABLE `tbl_ai_response` ADD `company` varchar(255);--> statement-breakpoint
ALTER TABLE `tbl_ai_response` ADD `experience_years` int;--> statement-breakpoint
ALTER TABLE `tbl_ai_response` ADD `location` varchar(255);--> statement-breakpoint
ALTER TABLE `tbl_ai_response` ADD `responsibilities` longtext NOT NULL;--> statement-breakpoint
ALTER TABLE `tbl_ai_response` ADD `achievements` longtext NOT NULL;