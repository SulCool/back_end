import express from "express";
import { addTask, getTaskFilePath, getTaskById, deleteTask, completeTask, updateTask } from "../database/bd.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const urlencodedParser = express.urlencoded({ extended: false });
const router = express.Router();

const uploadDir = "public/uploads/";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

router.post("/add_task", (req, res) => {
    upload.single("file")(req, res, (err) => {
        if (err) {
            console.error("Ошибка при загрузке файла:", err.message);
            return res.status(500).send("Ошибка при загрузке файла");
        }
        const { title, description, "start-time": startTime, "end-time": endTime, executor, type } = req.body;
        const currentUser = res.locals.user;
        if (!title || !description || !startTime || !endTime || !executor || !type) {
            return res.status(400).send("Все поля должны быть заполнены");
        }
        if (executor === currentUser.Login) {
            return res.status(400).send("Вы не можете назначить задачу самому себе");
        }
        const filePath = req.file ? `/uploads/${req.file.filename}` : null;
        const userName = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
        addTask(title, description, startTime, endTime, currentUser.Login, executor, userName, filePath, type, (err) => {
            if (err) {
                console.error("Ошибка при добавлении задачи:", err.message);
                return res.status(500).send("Ошибка сервера");
            }
            return res.redirect("/");
        });
    });
});

router.get("/download/:filename", (req, res) => {
    console.log(`[DEBUG] Вызван маршрут /download/:filename с filename: ${req.params.filename}`);
    const filename = req.params.filename;

    getTaskFilePath(filename, (err, row) => {
        if (err) {
            console.error("Ошибка при поиске файла в базе данных:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        if (!row) {
            console.log(`[DEBUG] Файл не найден в базе данных: ${filename}`);
            return res.status(404).send("Файл не найден");
        }

        console.log(`[DEBUG] Найден File_path в базе данных: ${row.File_path}`);
        const filePath = path.join(__dirname, "../public", row.File_path);
        console.log(`[DEBUG] Путь к файлу на диске: ${filePath}`);
        if (!fs.existsSync(filePath)) {
            console.log(`[DEBUG] Файл не найден на диске: ${filePath}`);
            return res.status(404).send("Файл не найден");
        }

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/octet-stream");

        res.sendFile(filePath, (err) => {
            if (err) {
                console.error("Ошибка при отправке файла:", err.message);
                res.status(500).send("Ошибка при скачивании файла");
            } else {
                console.log(`[DEBUG] Файл успешно отправлен: ${filename}`);
            }
        });
    });
});

router.post("/delete_task", urlencodedParser, (req, res) => {
    const { taskId } = req.body;
    if (!taskId) {
        return res.status(400).send("ID задачи не указан");
    }
    getTaskById(taskId, (err, row) => {
        if (err) {
            console.error("Ошибка при получении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        const filePath = row?.File_path;
        deleteTask(taskId, (err) => {
            if (err) {
                console.error("Ошибка при удалении задачи:", err.message);
                return res.status(500).send("Ошибка сервера");
            }
            if (filePath) {
                const fullPath = path.join(__dirname, "../public", filePath);
                fs.unlink(fullPath, (err) => {
                    if (err) console.error("Ошибка при удалении файла:", err.message);
                });
            }
            res.redirect("/");
        });
    });
});

router.post("/complete_task", urlencodedParser, (req, res) => {
    const { taskId } = req.body;
    const dateEnded = new Date().toISOString();

    completeTask(taskId, dateEnded, (err) => {
        if (err) {
            console.error("Ошибка при завершении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        res.redirect("/");
    });
});

router.post("/edit_task", (req, res) => {
    upload.single("file")(req, res, (err) => {
        if (err) {
            console.error("Ошибка при загрузке файла:", err.message);
            return res.status(500).send("Ошибка при загрузке файла");
        }

        const { taskId, title, description, "start-time": startTime, "end-time": endTime, executor, type } = req.body;
        const currentUser = res.locals.user;

        if (!taskId || !title || !description || !startTime || !endTime || !executor || !type) {
            return res.status(400).send("Все поля должны быть заполнены");
        }

        getTaskById(taskId, (err, row) => {
            if (err || !row) {
                return res.status(404).send("Задача не найдена");
            }

            const filePath = req.file ? `/uploads/${req.file.filename}` : row.File_path;

            updateTask(taskId, title, description, startTime, endTime, executor, filePath, type, (err) => {
                if (err) {
                    console.error("Ошибка при обновлении задачи:", err.message);
                    return res.status(500).send("Ошибка сервера");
                }
                res.redirect("/");
            });
        });
    });
});

export { router as taskRoutes };