import {
  getAttributeOptionsHandler,
  getGenderOptionsHandler,
  getCitiesHandler,
  getJobTypeDetailsHandler,
  getCareerLevelDetailsHandler,
  getEducationOptionsHandler,
  getIndustryOptionsHandler,
  getSalaryTypeOptionsHandler,
  getSkillsOptionsHandler,
  getLocationTypeOptionsHandler,
  addCustomAttributeHandler,
  addCustomAttributesHandler,
  getJobRoleTypesOptionsHandler,
  writeWithAiHandler,
  getDepartmentsHandler,
  getOrganizationHandler,
} from "../controller/attribute.controller.js";
import { tryCatch } from "../util/tryCatch_Block";

export const getAttributeOptions = tryCatch(
  "Get Attribute Options Handler",
  getAttributeOptionsHandler
);

export const getGenderOptions = tryCatch(
  "Get Gender Options Handler",
  getGenderOptionsHandler
);

export const getCitiesOptions = tryCatch(
  "Get Cities Handler",
  getCitiesHandler
);

export const getJobTypeOptions = tryCatch(
  "Get Job Type Handler",
  getJobTypeDetailsHandler
);

export const getCareerLevelOptions = tryCatch(
  "Get Career Level Handler",
  getCareerLevelDetailsHandler
);

export const getEducationOptions = tryCatch(
  "Get Education Options Handler",
  getEducationOptionsHandler
);

export const getIndustryOptions = tryCatch(
  "Get Industry Options Handler",
  getIndustryOptionsHandler
);

export const getSalaryTypeOptions = tryCatch(
  "Get Salary Type Options Handler",
  getSalaryTypeOptionsHandler
);

export const getSkillsOptions = tryCatch(
  "Get Skills Options Handler",
  getSkillsOptionsHandler
);

export const getLocationTypeOptions = tryCatch(
  "Get Location Type Options Handler",
  getLocationTypeOptionsHandler
);

export const getJobRoleTypesOptions = tryCatch(
  "Get Job Role Types Options Handler",
  getJobRoleTypesOptionsHandler
);

export const addCustomAttribute = tryCatch(
  "Add Custom Attribute Handler",
  addCustomAttributeHandler
);

export const addCustomAttributes = tryCatch(
  "Add Custom Attribute Handler",
  addCustomAttributesHandler
);

export const writeWithAi = tryCatch(
  "Write With AI Handler",
  writeWithAiHandler
);

export const getDepartments = tryCatch(
  "Get Departments Handler",
  getDepartmentsHandler
);

export const getOrganization = tryCatch(
  "Get Organization Handler",
  getOrganizationHandler
);
