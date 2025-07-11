import { Router } from "express";
import {
  getAttributeOptions,
  getCitiesOptions,
  getGenderOptions,
  getJobTypeOptions,
  getCareerLevelOptions,
  getEducationOptions,
  getIndustryOptions,
  getSalaryTypeOptions,
  getSkillsOptions,
  getLocationTypeOptions,
  addCustomAttribute,
} from "../services/attribute.service";

const routes = Router();

// Specific routes first
routes.get("/cities", getCitiesOptions);
routes.get("/gender", getGenderOptions);
routes.get("/job-type", getJobTypeOptions);
routes.get("/career-level", getCareerLevelOptions);
routes.get("/education", getEducationOptions);
routes.get("/industry", getIndustryOptions);
routes.get("/salary-type", getSalaryTypeOptions);
routes.get("/skills", getSkillsOptions);
routes.get("/location-type", getLocationTypeOptions);

// POST route for adding custom attributes
routes.post("/add-custom", addCustomAttribute);

// Dynamic route last
routes.get("/:parentId", getAttributeOptions);

export { routes as AttributeRoutes };
