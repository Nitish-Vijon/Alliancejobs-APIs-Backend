import { mysqlEnum } from "drizzle-orm/mysql-core";
import {
  mysqlTable,
  index,
  int,
  varchar,
  longtext,
  text,
  timestamp,
  tinyint,
  primaryKey,
} from "drizzle-orm/mysql-core";

export const attribute = mysqlTable(
  "attribute",
  {
    id: int().notNull().primaryKey(),
    name: varchar({ length: 255 }).default("NULL"),
    parentId: varchar("parent_id", { length: 255 }).default("NULL"),
    icon: varchar({ length: 255 }).default("NULL"),
  },
  (table) => [
    index("id").on(table.id),
    index("name").on(table.name, table.parentId),
  ]
);

export const blog = mysqlTable("blog", {
  id: int().notNull().primaryKey(),
  catId: int("cat_id").notNull(),
  subCatId: int("sub_cat_id").notNull(),
  title: varchar({ length: 255 }).notNull(),
  slug: varchar({ length: 255 }).notNull(),
  author: varchar({ length: 255 }).notNull(),
  image: varchar({ length: 255 }).notNull(),
  description: longtext().notNull(),
  dateTime: varchar("date_time", { length: 255 }).default("NULL"),
});

export const blogCategory = mysqlTable("blog_category", {
  id: int().notNull().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  slug: varchar({ length: 255 }).notNull(),
  description: varchar({ length: 255 }).notNull(),
  pid: varchar({ length: 255 }).default("'0'").notNull(),
});

export const cities = mysqlTable(
  "cities",
  {
    id: int().notNull().primaryKey(),
    name: varchar({ length: 30 }).notNull(),
    stateId: int("state_id").notNull(),
    conId: int("con_id").default(0).notNull(),
  },
  (table) => [index("state_id").on(table.stateId, table.conId)]
);

export const countries = mysqlTable(
  "countries",
  {
    id: int().notNull().primaryKey(),
    shortname: varchar({ length: 3 }).notNull(),
    name: varchar({ length: 150 }).notNull(),
    phonecode: int().notNull(),
  },
  (table) => [index("id_name").on(table.id, table.name)]
);

export const jobpostIp = mysqlTable("jobpostIp", {
  id: int().notNull().primaryKey(),
  jobid: int().notNull(),
  ip: varchar({ length: 100 }).notNull(),
});

export const jobsdescriptions = mysqlTable("jobsdescriptions", {
  id: int().notNull().primaryKey(),
  jobTitle: varchar({ length: 200 }).notNull(),
  desicription: text().notNull(),
});

export const megaMenu = mysqlTable("megaMenu", {
  id: int().notNull().primaryKey(),
  status: tinyint().default(1),
  content: text().default("NULL"),
  position: int().default(0),
  orderNumber: int().default(0),
  type: int().default(0),
  menuType: int().default(0),
  linkTo: int().default(0),
  hyperlinkType: int().default(0),
  categoryHyperlinkId: int().default(0),
  collegeHyperlinkId: int().default(0),
  coursesHyperlinkId: int().default(0),
  hyperlinkCustom: varchar({ length: 255 }).default("NULL"),
  blogHyperlinkId: int().default(0),
  oldProductHyperlinkId: int().default(0),
  newsHyperlinkId: int().default(0),
});

export const siteSetting = mysqlTable("site_setting", {
  id: int().notNull().primaryKey(),
  settingName: varchar("setting_name", { length: 255 }).notNull(),
  settingValue: varchar("setting_value", { length: 255 }).notNull(),
});

export const states = mysqlTable("states", {
  id: int().notNull().primaryKey(),
  name: varchar({ length: 30 }).notNull(),
  countryId: int("country_id").default(1).notNull(),
});

export const tblAdmin = mysqlTable("tbl_admin", {
  adminId: int("admin_id").notNull().primaryKey(),
  adminName: varchar("admin_name", { length: 255 }).notNull(),
  adminEmail: varchar("admin_email", { length: 255 }).notNull(),
  adminPhone: varchar("admin_phone", { length: 255 }).notNull(),
  adminPassword: varchar("admin_password", { length: 255 }).notNull(),
  adminType: varchar("admin_type", { length: 255 }).notNull(),
  createdDate: varchar("created_date", { length: 255 }).notNull(),
  status: varchar({ length: 255 }).default("'0'").notNull(),
  userDemo: varchar("user_demo", { length: 255 }).default("NULL"),
});

export const tblAds = mysqlTable("tbl_ads", {
  id: int().notNull().primaryKey(),
  uid: int().notNull(),
  adsType: tinyint("ads_type").notNull(),
  filepath: varchar({ length: 500 }).notNull(),
  status: tinyint().default(1).notNull(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default("current_timestamp()")
    .notNull(),
});

export const tblCatSector = mysqlTable("tbl_cat_sector", {
  id: int().notNull().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  slug: varchar({ length: 255 }).default("NULL"),
  pid: int().default(0),
  icon: varchar({ length: 255 }).default("NULL"),
});

export const tblContact = mysqlTable("tbl_contact", {
  id: int().notNull().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  phone: varchar({ length: 255 }).notNull(),
  purpose: varchar({ length: 255 }).notNull(),
  enquiry: longtext().notNull(),
  date: varchar({ length: 255 }).notNull(),
});

export const tblJobApply = mysqlTable("tbl_job_apply", {
  id: int().notNull().primaryKey(),
  candId: int("cand_id").default(0).notNull(),
  jobId: int("job_id").default(0).notNull(),
  eId: varchar("e_id", { length: 255 }).notNull(),
  jobRole: varchar("job_role", { length: 100 }).default("NULL"),
  location: varchar({ length: 100 }).default("NULL"),
  status: varchar({ length: 255 }).default("'0'").notNull(),
  applyStatus: tinyint("apply_status").default(0).notNull(),
  date: varchar({ length: 255 }).default("NULL"),
});

export const tblJobPost = mysqlTable("tbl_job_post", {
  id: int().notNull().primaryKey(),
  postDate: varchar("post_date", { length: 255 }).default("NULL"),
  eId: int("e_id").default(0),
  jobTitle: varchar("job_title", { length: 255 }).default("NULL"),
  jobDesc: text("job_desc").default("NULL"),
  applicationDeadline: varchar("application_deadline", { length: 255 }).default(
    "NULL"
  ),
  totalVacancies: int("total_vacancies").default(0),
  jobSector: varchar("job_sector", { length: 225 }).default("'0'"),
  jobType: int("job_type").default(0),
  requiredSkills: varchar("required_skills", { length: 255 }).default("NULL"),
  locationType: varchar("location_type", { length: 100 })
    .default("'0'")
    .notNull(),
  salaryType: int("salary_type").default(0),
  minSalary: int("min_salary").default(0),
  maxSalary: int("max_salary").default(0),
  negotiableSalary: int("negotiable_salary").default(0).notNull(),
  otherBenfits: varchar("other_benfits", { length: 255 }).default("'0'"),
  typeBenfits: varchar("type_benfits", { length: 255 }).default("NULL"),
  careerLevel: varchar("career_level", { length: 225 }).default("'0'"),
  expMin: int("exp_min").default(0).notNull(),
  expMax: int("exp_max").default(0).notNull(),
  expFresher: int("exp_fresher").default(0).notNull(),
  gender: varchar({ length: 255 }).default("NULL"),
  industry: varchar({ length: 225 }).default("'0'"),
  qualifications: int().default(0),
  streamBranch: varchar("stream_branch", { length: 255 }).default("NULL"),
  country: int().default(101),
  state: int().default(0),
  city: int().default(0),
  postalCode: int("postal_code").default(0),
  interviewMode: varchar("interview_mode", { length: 255 }).default("NULL"),
  fullAddress: varchar("full_address", { length: 255 }).default("NULL"),
  immediteJoin: int("immedite_join").default(0).notNull(),
  columnType: varchar("column_type", { length: 20 }).default("'1'").notNull(),
  feature: int().default(0).notNull(),
  view: int().default(0).notNull(),
  status: int().default(0).notNull(),
});

export const tblMsg = mysqlTable("tbl_msg", {
  id: int().notNull().primaryKey(),
  roomNo: varchar("room_no", { length: 255 }).notNull(),
  msg: varchar({ length: 255 }).notNull(),
  date: varchar({ length: 255 }).notNull(),
  senderId: varchar("sender_id", { length: 255 }).notNull(),
});

export const tblNotification = mysqlTable("tbl_notification", {
  id: int().notNull().primaryKey(),
  candId: varchar("cand_id", { length: 255 }).default("NULL"),
  msg: varchar({ length: 255 }).default("NULL"),
  date: varchar({ length: 255 }).default("NULL"),
});

export const tblResume = mysqlTable("tbl_resume", {
  id: int().notNull().primaryKey(),
  candId: varchar("cand_id", { length: 255 }).default("NULL"),
  coverLetter: longtext("cover_letter").default("NULL"),
  skills: varchar({ length: 255 }).default("NULL"),
  location: varchar({ length: 255 }).default("NULL"),
  hobbies: varchar({ length: 255 }).default("NULL"),
  cv: varchar({ length: 255 }).default("NULL"),
  education: longtext().default("NULL"),
  experience: longtext().default("NULL"),
  portfolio: longtext().default("NULL"),
  language: longtext().default("NULL"),
  noticePeriod: varchar("notice_period", { length: 255 }).default("NULL"),
  award: longtext("Award").default("NULL"),
});

export const tblSaved = mysqlTable("tbl_saved", {
  id: int().notNull().primaryKey(),
  canId: varchar("can_id", { length: 255 }).notNull(),
  empId: varchar("emp_id", { length: 255 }).notNull(),
});

export const tblSearch = mysqlTable("tbl_search", {
  id: int().notNull().primaryKey(),
  catId: int("cat_id").notNull(),
  jobId: int("job_id").notNull(),
  count: int().notNull(),
  status: tinyint().default(1).notNull(),
});

export const tblSeo = mysqlTable("tbl_seo", {
  id: int().notNull().primaryKey(),
  link: int().notNull(),
  title: varchar({ length: 500 }).notNull(),
  keyword: text().default("NULL"),
  description: text().default("NULL"),
});

export const tblSubscribe = mysqlTable("tbl_subscribe", {
  id: int().notNull().primaryKey(),
  fromPage: int("from_page").notNull(),
  email: varchar({ length: 100 }).notNull(),
  status: tinyint().default(1).notNull(),
  createdAt: timestamp("created_at", { mode: "string" })
    .default("current_timestamp()")
    .notNull(),
});

export const tblUsers = mysqlTable("tbl_users", {
  id: int().notNull().primaryKey(), // Remove autoincrement as SQL doesn't show AUTO_INCREMENT
  compId: int("comp_id").default(0), // Allow NULL as per SQL
  username: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  device_fcm: varchar("device_fcm", { length: 255 }).default("NULL"),
  fbId: varchar("fb_id", { length: 255 }).default("NULL"),
  linkedinId: varchar("linkedin_id", { length: 255 }).default("NULL"),
  googleId: varchar("google_id", { length: 255 }).default("NULL"),
  code: varchar({ length: 255 }).default("NULL"),
  psw: varchar({ length: 255 }).notNull(),
  phone: varchar({ length: 255 }).default("NULL"),
  phone2: varchar({ length: 255 }).default("NULL"),
  profilePic: varchar("profile_pic", { length: 255 }).default("NULL"),
  coverImage: varchar("cover_image", { length: 255 }).default("NULL"),
  website: varchar({ length: 255 }).default("NULL"),
  foundedDate: varchar("founded_date", { length: 255 }).default("NULL"),
  sectorId: varchar("sector_id", { length: 255 }).default("NULL"),
  industryId: int("industry_id").default(0), // Allow NULL as per SQL
  organization: varchar({ length: 255 }).default("NULL"),
  canDesc: text("can_desc").default("NULL"),
  gender: varchar({ length: 255 }).default("NULL"),
  dob: varchar({ length: 255 }).default("NULL"),
  age: int().default(0), // Allow NULL as per SQL
  facebook: varchar({ length: 255 }).default("NULL"),
  twitter: varchar({ length: 255 }).default("NULL"),
  linkedin: varchar({ length: 255 }).default("NULL"),
  dribbble: varchar({ length: 255 }).default("NULL"),
  state: int().default(0).notNull(),
  city: int().default(0).notNull(),
  pincode: int().default(0).notNull(),
  fullAddress: text("full_address").default("NULL"),
  publicView: int("public_view").default(1).notNull(),
  type: varchar({ length: 255 }).default("NULL"),
  everify: varchar({ length: 255 }).default("'0'").notNull(),
  status: varchar({ length: 255 }).default("'1'").notNull(),
  otp: varchar({ length: 255 }).default("NULL"),
  createdDate: varchar("created_date", { length: 255 }).notNull(),
  user: varchar({ length: 255 }).default("NULL"),
  utmSource: varchar("utm_source", { length: 200 }).default("NULL"),
  utmMedium: varchar("utm_medium", { length: 200 }).default("NULL"),
  utmCampaign: varchar("utm_campaign", { length: 200 }).default("NULL"),
  utmContent: varchar("utm_content", { length: 200 }).default("NULL"),
  totalView: varchar("total_view", { length: 255 }).default("'0'"),
});

export const tblWishlist = mysqlTable("tbl_wishlist", {
  id: int().notNull().primaryKey(),
  loginId: int("login_id").default(0).notNull(),
  jobId: int("job_id").default(0).notNull(),
});

export const users = mysqlTable("users", {
  id: int().notNull().primaryKey(),
  googleId: varchar("google_id", { length: 150 }).notNull(),
  name: varchar({ length: 50 }).notNull(),
  email: varchar({ length: 50 }).notNull(),
  profileImage: text("profile_image").notNull(),
});

export const tblAIResponse = mysqlTable("tbl_ai_response", {
  id: int().notNull().primaryKey(),
  role: varchar("role", { length: 255 }),
  prompt: longtext("prompt").notNull(),
  answer: longtext("answer").notNull(),
  type: mysqlEnum("type", [
    "Address",
    "Education",
    "Experience",
    "Portfolio",
    "Awards",
    "Skills",
  ]).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});
