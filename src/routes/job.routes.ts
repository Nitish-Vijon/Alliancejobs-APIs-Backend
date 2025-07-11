import { Router } from "express";
import {
  filter_jobs,
  jobDetails,
  recent_jobs,
  search_jobs,
} from "../services/job.service";

const routes = Router();

routes.get("/get-recent-jobs", recent_jobs);
routes.get("/search-jobs", search_jobs);
routes.get("/job-details/:jobId", jobDetails);
routes.get("/filter-jobs", filter_jobs);
export { routes as JobRoutes };
