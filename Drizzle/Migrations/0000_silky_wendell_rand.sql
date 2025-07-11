-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations

-- If You Want to add this migration please Add this code in __journal.json
    -- {
    --   "idx": 0,
    --   "version": "5",
    --   "when": 1751278772212,
    --   "tag": "0000_silky_wendell_rand",
    --   "breakpoints": true
    -- },

CREATE TABLE `attribute` (
	`id` int(11) NOT NULL,
	`name` varchar(255) DEFAULT 'NULL',
	`parent_id` varchar(255) DEFAULT 'NULL',
	`icon` varchar(255) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `blog` (
	`id` int(11) NOT NULL,
	`cat_id` int(11) NOT NULL,
	`sub_cat_id` int(11) NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`author` varchar(255) NOT NULL,
	`image` varchar(255) NOT NULL,
	`description` longtext NOT NULL,
	`date_time` varchar(255) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `blog_category` (
	`id` int(11) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` varchar(255) NOT NULL,
	`pid` varchar(255) NOT NULL DEFAULT '''0'''
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` int(11) NOT NULL,
	`name` varchar(30) NOT NULL,
	`state_id` int(11) NOT NULL,
	`con_id` int(11) NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `countries` (
	`id` int(11) NOT NULL,
	`shortname` varchar(3) NOT NULL,
	`name` varchar(150) NOT NULL,
	`phonecode` int(11) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobpostIp` (
	`id` int(11) NOT NULL,
	`jobid` int(11) NOT NULL,
	`ip` varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobsdescriptions` (
	`id` int(11) NOT NULL,
	`jobTitle` varchar(200) NOT NULL,
	`desicription` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `megaMenu` (
	`id` int(11) NOT NULL,
	`status` tinyint(1) DEFAULT 1,
	`content` text DEFAULT NULL,
	`position` int(11) DEFAULT NULL,
	`orderNumber` int(11) DEFAULT NULL,
	`type` int(11) DEFAULT NULL,
	`menuType` int(11) DEFAULT NULL,
	`linkTo` int(11) DEFAULT NULL,
	`hyperlinkType` int(11) DEFAULT NULL,
	`categoryHyperlinkId` int(11) DEFAULT NULL,
	`collegeHyperlinkId` int(11) DEFAULT NULL,
	`coursesHyperlinkId` int(11) DEFAULT NULL,
	`hyperlinkCustom` varchar(255) DEFAULT 'NULL',
	`blogHyperlinkId` int(11) DEFAULT NULL,
	`oldProductHyperlinkId` int(11) DEFAULT NULL,
	`newsHyperlinkId` int(11) DEFAULT NULL
);
--> statement-breakpoint
CREATE TABLE `site_setting` (
	`id` int(11) NOT NULL,
	`setting_name` varchar(255) NOT NULL,
	`setting_value` varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `states` (
	`id` int(11) NOT NULL,
	`name` varchar(30) NOT NULL,
	`country_id` int(11) NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `tbl_admin` (
	`admin_id` int(11) NOT NULL,
	`admin_name` varchar(255) NOT NULL,
	`admin_email` varchar(255) NOT NULL,
	`admin_phone` varchar(255) NOT NULL,
	`admin_password` varchar(255) NOT NULL,
	`admin_type` varchar(255) NOT NULL,
	`created_date` varchar(255) NOT NULL,
	`status` varchar(255) NOT NULL DEFAULT '''0''',
	`user_demo` varchar(255) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `tbl_ads` (
	`id` int(11) NOT NULL,
	`uid` int(11) NOT NULL,
	`ads_type` tinyint(4) NOT NULL,
	`filepath` varchar(500) NOT NULL,
	`status` tinyint(4) NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `tbl_cat_sector` (
	`id` int(11) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) DEFAULT 'NULL',
	`pid` int(11) DEFAULT 0,
	`icon` varchar(255) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `tbl_contact` (
	`id` int(11) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(255) NOT NULL,
	`purpose` varchar(255) NOT NULL,
	`enquiry` longtext NOT NULL,
	`date` varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tbl_job_apply` (
	`id` int(11) NOT NULL,
	`cand_id` int(11) NOT NULL DEFAULT 0,
	`job_id` int(11) NOT NULL DEFAULT 0,
	`e_id` varchar(255) NOT NULL,
	`job_role` varchar(100) DEFAULT 'NULL',
	`location` varchar(100) DEFAULT 'NULL',
	`status` varchar(255) NOT NULL DEFAULT '''0''',
	`apply_status` tinyint(4) NOT NULL DEFAULT 0,
	`date` varchar(255) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `tbl_job_post` (
	`id` int(11) NOT NULL,
	`post_date` varchar(255) DEFAULT NULL,
	`e_id` int(11) DEFAULT 0,
	`job_title` varchar(255) DEFAULT 'NULL',
	`job_desc` text DEFAULT NULL,
	`application_deadline` varchar(255) DEFAULT 'NULL',
	`total_vacancies` int(11) DEFAULT NULL,
	`job_sector` varchar(225) DEFAULT '''0''',
	`job_type` int(11) DEFAULT 0,
	`required_skills` varchar(255) DEFAULT 'NULL',
	`location_type` varchar(100) NOT NULL DEFAULT '''0''',
	`salary_type` int(11) DEFAULT 0,
	`min_salary` int(11) DEFAULT 0,
	`max_salary` int(11) DEFAULT 0,
	`negotiable_salary` int(11) NOT NULL DEFAULT 0,
	`other_benfits` varchar(255) DEFAULT '''0''',
	`type_benfits` varchar(255) DEFAULT 'NULL',
	`career_level` varchar(225) DEFAULT '''0''',
	`exp_min` int(11) NOT NULL DEFAULT 0,
	`exp_max` int(11) NOT NULL DEFAULT 0,
	`exp_fresher` int(11) NOT NULL DEFAULT 0,
	`gender` varchar(255) DEFAULT 'NULL',
	`industry` varchar(225) DEFAULT '''0''',
	`qualifications` int(11) DEFAULT NULL,
	`stream_branch` varchar(255) DEFAULT 'NULL',
	`country` int(11) DEFAULT 101,
	`state` int(11) DEFAULT 0,
	`city` int(11) DEFAULT 0,
	`postal_code` int(11) DEFAULT 0,
	`interview_mode` varchar(255) DEFAULT 'NULL',
	`full_address` varchar(255) DEFAULT 'NULL',
	`immedite_join` int(11) NOT NULL DEFAULT 0,
	`column_type` varchar(20) NOT NULL DEFAULT '''1''',
	`feature` int(11) NOT NULL DEFAULT 0,
	`view` int(11) NOT NULL DEFAULT 0,
	`status` int(11) NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `tbl_msg` (
	`id` int(11) NOT NULL,
	`room_no` varchar(255) NOT NULL,
	`msg` varchar(255) NOT NULL,
	`date` varchar(255) NOT NULL,
	`sender_id` varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tbl_notification` (
	`id` int(11) NOT NULL,
	`cand_id` varchar(255) DEFAULT 'NULL',
	`msg` varchar(255) DEFAULT 'NULL',
	`date` varchar(255) DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE TABLE `tbl_resume` (
	`id` int(11) NOT NULL,
	`cand_id` varchar(255) DEFAULT 'NULL',
	`cover_letter` longtext DEFAULT NULL,
	`skills` varchar(255) DEFAULT 'NULL',
	`location` varchar(255) DEFAULT 'NULL',
	`hobbies` varchar(255) DEFAULT 'NULL',
	`cv` varchar(255) DEFAULT 'NULL',
	`education` longtext DEFAULT NULL,
	`experience` longtext DEFAULT NULL,
	`portfolio` longtext DEFAULT NULL,
	`language` longtext DEFAULT NULL,
	`notice_period` varchar(255) DEFAULT 'NULL',
	`Award` longtext DEFAULT NULL
);
--> statement-breakpoint
CREATE TABLE `tbl_saved` (
	`id` int(11) NOT NULL,
	`can_id` varchar(255) NOT NULL,
	`emp_id` varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tbl_search` (
	`id` int(11) NOT NULL,
	`cat_id` int(11) NOT NULL,
	`job_id` int(11) NOT NULL,
	`count` int(11) NOT NULL,
	`status` tinyint(4) NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `tbl_seo` (
	`id` int(11) NOT NULL,
	`link` int(11) NOT NULL,
	`title` varchar(500) NOT NULL,
	`keyword` text DEFAULT NULL,
	`description` text DEFAULT NULL
);
--> statement-breakpoint
CREATE TABLE `tbl_subscribe` (
	`id` int(11) NOT NULL,
	`from_page` int(11) NOT NULL,
	`email` varchar(100) NOT NULL,
	`status` tinyint(4) NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `tbl_users` (
	`id` int(11) NOT NULL,
	`comp_id` int(11) DEFAULT NULL,
	`username` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`fb_id` varchar(255) DEFAULT NULL,
	`linkedin_id` varchar(255) DEFAULT 'NULL',
	`google_id` varchar(255) DEFAULT 'NULL',
	`code` varchar(255) DEFAULT 'NULL',
	`psw` varchar(255) NOT NULL,
	`phone` varchar(255) DEFAULT 'NULL',
	`phone2` varchar(255) DEFAULT 'NULL',
	`profile_pic` varchar(255) DEFAULT 'NULL',
	`cover_image` varchar(255) DEFAULT 'NULL',
	`website` varchar(255) DEFAULT 'NULL',
	`founded_date` varchar(255) DEFAULT 'NULL',
	`sector_id` varchar(255) DEFAULT 'NULL',
	`industry_id` int(11) DEFAULT NULL,
	`organization` varchar(255) DEFAULT 'NULL',
	`can_desc` text DEFAULT NULL,
	`gender` varchar(255) DEFAULT 'NULL',
	`dob` varchar(255) DEFAULT 'NULL',
	`age` int(11) DEFAULT NULL,
	`facebook` varchar(255) DEFAULT 'NULL',
	`twitter` varchar(255) DEFAULT 'NULL',
	`linkedin` varchar(255) DEFAULT 'NULL',
	`dribbble` varchar(255) DEFAULT 'NULL',
	`state` int(11) NOT NULL DEFAULT 0,
	`city` int(11) NOT NULL DEFAULT 0,
	`pincode` int(11) NOT NULL DEFAULT 0,
	`full_address` text DEFAULT NULL,
	`public_view` int(11) NOT NULL DEFAULT 1,
	`type` varchar(255) DEFAULT 'NULL',
	`everify` varchar(255) NOT NULL DEFAULT '''0''',
	`status` varchar(255) NOT NULL DEFAULT '''1''',
	`otp` varchar(255) DEFAULT 'NULL',
	`created_date` varchar(255) NOT NULL,
	`user` varchar(255) DEFAULT 'NULL',
	`utm_source` varchar(200) DEFAULT 'NULL',
	`utm_medium` varchar(200) DEFAULT 'NULL',
	`utm_campaign` varchar(200) DEFAULT 'NULL',
	`utm_content` varchar(200) DEFAULT 'NULL',
	`total_view` varchar(255) DEFAULT '''0'''
);
--> statement-breakpoint
CREATE TABLE `tbl_wishlist` (
	`id` int(11) NOT NULL,
	`login_id` int(11) NOT NULL DEFAULT 0,
	`job_id` int(11) NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int(11) NOT NULL,
	`google_id` varchar(150) NOT NULL,
	`name` varchar(50) NOT NULL,
	`email` varchar(50) NOT NULL,
	`profile_image` text NOT NULL
);
--> statement-breakpoint

CREATE INDEX `id` ON `attribute` (`id`);
--> statement-breakpoint

CREATE INDEX `name` ON `attribute` (`name`, `parent_id`);
--> statement-breakpoint

CREATE INDEX `state_id` ON `cities` (`state_id`, `con_id`);
--> statement-breakpoint

CREATE INDEX `id` ON `countries` (`id`, `name`);
--> statement-breakpoint

ALTER TABLE `attribute` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `blog` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `blog_category` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `cities` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `countries` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `jobpostIp` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `jobsdescriptions` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `megaMenu` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `site_setting` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `states` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_admin` ADD PRIMARY KEY (`admin_id`);
--> statement-breakpoint
ALTER TABLE `tbl_ads` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_cat_sector` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_contact` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_job_apply` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_job_post` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_msg` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_notification` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_resume` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_saved` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_search` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_seo` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_subscribe` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_users` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `tbl_wishlist` ADD PRIMARY KEY (`id`);
--> statement-breakpoint
ALTER TABLE `users` ADD PRIMARY KEY (`id`);