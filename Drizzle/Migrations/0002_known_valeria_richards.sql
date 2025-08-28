ALTER TABLE `tbl_ai_response` ADD `department` varchar(255);--> statement-breakpoint
ALTER TABLE `tbl_ai_response` ADD `industry` varchar(255);--> statement-breakpoint
ALTER TABLE `tbl_ai_response` ADD `job_type` varchar(255);--> statement-breakpoint
ALTER TABLE `tbl_ai_response` ADD `salary` int;--> statement-breakpoint
ALTER TABLE `tbl_ai_response` DROP COLUMN `location`;--> statement-breakpoint
ALTER TABLE `tbl_ai_response` DROP COLUMN `responsibilities`;--> statement-breakpoint
ALTER TABLE `tbl_ai_response` DROP COLUMN `achievements`;