import express from "express";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import { userRoutes } from "./routes/userRoutes.js";
import { router as taskRoutes } from "./routes/taskRoutes.js";
import { fileURLToPath } from "url";
import path from "path";
import { checkDeadlines } from "./telegramBot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(authMiddleware);
app.use(userRoutes);
app.use(taskRoutes);

checkDeadlines();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});