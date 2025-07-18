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
  getUserEducation,
  deleteUserEducation,
  addUserEducation,
  getUserExperience,
  addUserExperience,
  deleteUserExperience,
  getUserPortfolio,
  addUserPortfolio,
  deleteUserPortfolio,
  getUserAwards,
  addUserAward,
  deleteUserAward,
  userProfileLoader,
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

// Education Routes
routes.patch("/education", authenticateUser, updateUserEducation);
routes.get("/education", authenticateUser, getUserEducation);
routes.post("/education", authenticateUser, addUserEducation);
routes.delete("/education", authenticateUser, deleteUserEducation);

// Experience Routes
routes.patch("/experience", authenticateUser, updateUserExperience);
routes.get("/experience", authenticateUser, getUserExperience);
routes.post("/experience", authenticateUser, addUserExperience);
routes.delete("/experience", authenticateUser, deleteUserExperience);

// Portfolio Routes
routes.patch("/portfolio", authenticateUser, updateUserPortfolio);
routes.get("/portfolio", authenticateUser, getUserPortfolio);
routes.post("/portfolio", authenticateUser, addUserPortfolio);
routes.delete("/portfolio", authenticateUser, deleteUserPortfolio);
routes.get("/profile-loader", authenticateUser, userProfileLoader);

// Awards Routes
routes.patch("/awards", authenticateUser, updateUserAwards);
routes.get("/awards", authenticateUser, getUserAwards);
routes.post("/awards", authenticateUser, addUserAward);
routes.delete("/awards", authenticateUser, deleteUserAward);

export { routes as UserRoutes };
