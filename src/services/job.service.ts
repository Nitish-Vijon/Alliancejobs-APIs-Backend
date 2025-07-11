import {
  getJobDetailsHandler,
  getJobsByFiltersHandler,
  getJobsBySearchHandler,
  getRecentJobsHandler,
} from "../controller/job.controller";
import { tryCatch } from "../util/tryCatch_Block";

export const recent_jobs = tryCatch("Get Recent Jobs", getRecentJobsHandler);
export const search_jobs = tryCatch(
  "Get Jobs By Search",
  getJobsBySearchHandler
);

export const jobDetails = tryCatch("Get Jobs By Search", getJobDetailsHandler);
export const filter_jobs = tryCatch(
  "Get Jobs By Filters",
  getJobsByFiltersHandler
);
