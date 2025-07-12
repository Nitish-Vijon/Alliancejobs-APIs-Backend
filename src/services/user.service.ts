import {
  getOtpForUserHandler,
  getUserAppliedJobsHandler,
  getUserRelatedProfileJobsHandler,
  updateUserAddressHandler,
  updateUserBasicInfoHandler,
  getUserSavedJobsHandler,
  verifiyOtpForUserHandler,
  updateUserEducationHandler,
  updateUserExperienceHandler,
  updateUserPortfolioHandler,
  updateUserAwardsHandler,
  updateUserSkillsHandler,
  getJobRecommendationsHandler,
} from "../controller/user.controller";
import { tryCatch } from "../util/tryCatch_Block";

export const getOtpforUser = tryCatch(
  "Get OTP Handler In User",
  getOtpForUserHandler
);

export const verifiyOtp = tryCatch(
  "Verify OTP Handler In User",
  verifiyOtpForUserHandler
);

export const userProfileRelatedJobs = tryCatch(
  "Get User Profile Related Jobs",
  getUserRelatedProfileJobsHandler
);

export const userRecommendationsJobs = tryCatch(
  "Get User Recommendations Jobs",
  getJobRecommendationsHandler
);

export const updateUserBasicInfo = tryCatch(
  "Update User Basic Info",
  updateUserBasicInfoHandler
);

export const updateUserAddress = tryCatch(
  "Update User Address",
  updateUserAddressHandler
);

export const updateUserEducation = tryCatch(
  "Update User Education",
  updateUserEducationHandler
);

export const updateUserExperience = tryCatch(
  "Update User Experience",
  updateUserExperienceHandler
);

export const updateUserPortfolio = tryCatch(
  "Update User Portfolio",
  updateUserPortfolioHandler
);

export const updateUserAwards = tryCatch(
  "Update User Awards",
  updateUserAwardsHandler
);

export const updateUserSkills = tryCatch(
  "Update User Skills",
  updateUserSkillsHandler
);

export const getUserSavedJobs = tryCatch(
  "Get User Saved Jobs",
  getUserSavedJobsHandler
);

export const getUserAppliedJobs = tryCatch(
  "Get User Applied Jobs",
  getUserAppliedJobsHandler
);
