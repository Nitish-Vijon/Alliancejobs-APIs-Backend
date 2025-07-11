import express, { NextFunction, Request, Response } from "express";
import { IndexRoutes } from "../routes/index.routes.js";
import { errorMiddleware } from "../middleware/errorMiddleware.js";
import path from "path";
const app = express();

app.use(express.json());

app.use(express.static("public"));
const uploadsPath = path.join(__dirname, "..", "..", "uploads");
app.use("/uploads", express.static(uploadsPath));

app.get("/my-ip", (req, res) => {
  res.send(req.ip); // or use a middleware like `express-ip`
});

app.use("/api/v1", IndexRoutes);

app.use(errorMiddleware);

// Add more routes and middleware here

export default app;
