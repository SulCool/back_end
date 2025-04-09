import { Router } from "express";
import { upload } from "../multerConfig.js";
import { addTask, completeTask, deleteTask, updateTask, getTaskById } from "../database/bd.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

router.post("/add_task", upload.single("file"), (req, res) => {
    console.log("[DEBUG] req.body после multer:", req.body);
    console.log("[DEBUG] req.file:", req.file);

    const { title, description, "start-time": startTime, "end-time": endTime, executors, type } = req.body;
    const currentUser = res.locals.user;

    console.log("[DEBUG] Полученные данные формы:");
    console.log("title:", title);
    console.log("description:", description);
    console.log("startTime:", startTime);
    console.log("endTime:", endTime);
    console.log("executors:", executors);
    console.log("type:", type);

    console.log("[DEBUG] Значения после .trim():");
    console.log("title.trim():", title?.trim());
    console.log("description.trim():", description?.trim());
    console.log("startTime:", startTime);
    console.log("endTime:", endTime);
    console.log("type.trim():", type?.trim());

    if (!title?.trim() || !description?.trim() || !startTime || !endTime || !type?.trim()) {
        console.log("[DEBUG] Ошибка: не все обязательные поля заполнены");
        return res.status(400).send("Все поля, кроме исполнителей, должны быть заполнены");
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.log("[DEBUG] Ошибка: некорректный формат даты");
        return res.status(400).send("Некорректный формат даты");
    }

    const selectedExecutors = Array.isArray(executors) ? executors.filter(e => e !== "") : [];
    console.log("[DEBUG] Выбранные исполнители:", selectedExecutors);

    if (selectedExecutors.includes(currentUser.Login)) {
        return res.status(400).send("Вы не можете назначить задачу самому себе");
    }
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const userName = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
    addTask(title, description, startTime, endTime, currentUser.Login, selectedExecutors, userName, filePath, type, (err) => {
        if (err) {
            console.error("Ошибка при добавлении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        return res.redirect("/");
    });
});

router.post("/complete_task", (req, res) => {
    const { taskId } = req.body;
    completeTask(taskId, (err) => {
        if (err) {
            console.error("Ошибка при завершении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        res.redirect("/");
    });
});

router.post("/delete_task", (req, res) => {
    const { taskId } = req.body;
    console.log("[DEBUG] req.body для /delete_task:", req.body);
    deleteTask(taskId, (err) => {
        if (err) {
            console.error("Ошибка при удалении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        res.redirect("/");
    });
});

router.post("/edit_task", upload.single("file"), async (req, res) => {
    console.log("[DEBUG] req.body для /edit_task:", req.body);
    console.log("[DEBUG] req.file:", req.file);

    const { taskId, title, description, "start-time": startTime, "end-time": endTime, executors, type } = req.body;

    try {
        const task = await new Promise((resolve, reject) => {
            getTaskById(taskId, (err, task) => {
                if (err) reject(err);
                else resolve(task);
            });
        });

        if (!task) {
            console.log(`[DEBUG] Задача с ID ${taskId} не найдена`);
            return res.status(404).send("Задача не найдена");
        }

        let filePath = task.File_path; 
        if (req.file) {
            if (task.File_path) {
                const oldFilePath = path.join(__dirname, "..", "public", task.File_path.replace("/uploads/", "uploads/"));
                try {
                    await fs.unlink(oldFilePath);
                    console.log(`[DEBUG] Старый файл удалён: ${oldFilePath}`);
                } catch (err) {
                    console.error(`[DEBUG] Ошибка при удалении старого файла ${oldFilePath}:`, err.message);
                }
            }
            filePath = `/uploads/${req.file.filename}`;
            const newFilePath = path.join(__dirname, "..", "public", filePath.replace("/uploads/", "uploads/"));
            try {
                await fs.access(newFilePath);
                console.log(`[DEBUG] Новый файл доступен: ${newFilePath}`);
            } catch (err) {
                console.error(`[DEBUG] Новый файл не найден: ${newFilePath}`, err.message);
                return res.status(500).send("Ошибка: загруженный файл не сохранён на сервере");
            }
        }

        const selectedExecutors = Array.isArray(executors) ? executors.filter(e => e !== "") : [];
        updateTask(taskId, title, description, startTime, endTime, selectedExecutors, filePath, type, (err) => {
            if (err) {
                console.error("Ошибка при обновлении задачи:", err.message);
                return res.status(500).send("Ошибка сервера");
            }
            res.redirect("/");
        });
    } catch (err) {
        console.error("Ошибка в /edit_task:", err.message);
        res.status(500).send("Ошибка сервера");
    }
});

export { router };