import express from "express";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import { userRoutes } from "./routes/userRoutes.js";
import { taskRoutes } from "./routes/taskRoutes.js";
import { fileURLToPath } from "url"; 
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = 3000;
export const urlencodedParser = express.urlencoded({ extended: false });

app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); 

app.use(authMiddleware);
app.use(userRoutes);
app.use(taskRoutes);
app.use(express.static(path.join(__dirname, "public"))); 

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});