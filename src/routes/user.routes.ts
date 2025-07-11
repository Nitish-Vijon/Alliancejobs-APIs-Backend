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
} from "../services/user.service";
import { authenticateUser } from "../middleware/middleware";
import { upload } from "../middleware/multer.middleware";

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

routes.post(
  "/user-saved-jobs",
  upload.single("profilePic"),
  authenticateUser,
  getUserSavedJobs
);
routes.get("/user-applied-jobs", authenticateUser, getUserAppliedJobs);
export { routes as UserRoutes };
