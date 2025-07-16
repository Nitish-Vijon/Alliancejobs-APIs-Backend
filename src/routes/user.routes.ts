import { Router } from "express";
import {
  getOtpforUser,
  updateUserAddress,
  updateUserBasicInfo,
  updateUserEducation,
  updateUserExperience,
  updateUserPortfolio,
  updateUserAwards,
  updateUserSkills,
  getUserAppliedJobs,
  getUserSavedJobs,
  userProfileRelatedJobs,
  verifiyOtp,
  userRecommendationsJobs,
  getUserFavoriteJobs,
  get_Data_For_Apply_Job,
  Apply_Job,
  upload_Resume,
  get_User_Resume,
  download_Resume,
} from "../services/user.service";
import { authenticateUser } from "../middleware/middleware";
import {
  handleFileUploadErrors,
  upload,
} from "../middleware/multer.middleware";

const routes = Router();
routes.post("/get-otp", getOtpforUser);
routes.post("/verify-otp", verifiyOtp);

// Profile Update Routes
routes.get(
  "/user-profile-related-jobs",
  authenticateUser,
  userProfileRelatedJobs
);
routes.get("/user-recommendations", authenticateUser, userRecommendationsJobs);
routes.patch("/basic-info", authenticateUser, updateUserBasicInfo);
routes.patch("/address", authenticateUser, updateUserAddress);
routes.patch("/education", authenticateUser, updateUserEducation);
routes.patch("/experience", authenticateUser, updateUserExperience);
routes.patch("/portfolio", authenticateUser, updateUserPortfolio);
routes.patch("/awards", authenticateUser, updateUserAwards);
routes.patch("/skills", authenticateUser, updateUserSkills);

routes.post("/user-saved-jobs", authenticateUser, getUserSavedJobs);
routes.get("/user-applied-jobs", authenticateUser, getUserAppliedJobs);
routes.get("/user-favorite-jobs", authenticateUser, getUserFavoriteJobs);
routes.get(
  "/get_Data_For_Apply_Job/:jobId",
  authenticateUser,
  get_Data_For_Apply_Job
);

routes.post("/apply-job/:jobId", authenticateUser, Apply_Job);
routes.post(
  "/use-upload-resume",
  authenticateUser,
  upload.single("resume"),
  upload_Resume
);
routes.get("/get_User_Resume", authenticateUser, get_User_Resume);
routes.get("/download-resume/:filename", authenticateUser, download_Resume);
export { routes as UserRoutes };
