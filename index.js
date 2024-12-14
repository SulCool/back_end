import express from "express";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware.js";
import { userRoutes } from "./routes/userRoutes.js";
import { taskRoutes } from "./routes/taskRoutes.js";

export const app = express();
const PORT = 3000;
export const __dirname = import.meta.dirname;
export const urlencodedParser = express.urlencoded({ extended: false });

app.use(cookieParser());
app.use(express.static(__dirname + "/public"));
app.set('view engine', 'ejs');
app.set('views', __dirname + "/views");

app.use(authMiddleware);
app.use(userRoutes);
app.use(taskRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});







