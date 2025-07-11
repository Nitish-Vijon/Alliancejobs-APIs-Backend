import { Router } from "express";
import { UserRoutes } from "./user.routes.js";
import { JobRoutes } from "./job.routes.js";
import { AttributeRoutes } from "./attribute.routes.js";

export const routes = Router();

routes.use("/user", UserRoutes);
routes.use("/jobs", JobRoutes);
routes.use("/attributes", AttributeRoutes);

export { routes as IndexRoutes };
