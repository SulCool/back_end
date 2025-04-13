import { Router } from "express";
import { upload } from "../multerConfig.js";
import { addTask, completeTask, deleteTask, updateTask, getTaskById, getTaskExecutors, querySelect } from "../database/bd.js";
import { sendNotification } from "../telegramBot.js";
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
    addTask(title, description, startTime, endTime, currentUser.Login, selectedExecutors, userName, filePath, type, (err, taskId) => {
        if (err) {
            console.error("Ошибка при добавлении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        selectedExecutors.forEach((executor) => {
            const queryUser = 'SELECT id FROM users WHERE CONCAT(Surname, " ", Name, " ", Patronymic) = ?';
            querySelect(queryUser, [executor], (err, userRows) => {
                if (err || userRows.length === 0) {
                    console.error(`Пользователь ${executor} не найден`);
                    return;
                }
                const userId = userRows[0].id;
                const message = `Вам назначена задача "${title}". Дедлайн: ${new Date(endTime).toLocaleDateString()}.`;
                sendNotification(userId, message);
            });
        });
        return res.redirect("/");
    });
});

router.post("/complete_task", (req, res) => {
    const { taskId } = req.body;
    const dateEnded = new Date().toISOString();
    querySelect('SELECT Title FROM tasks WHERE id = ?', [taskId], (err, taskRows) => {
        if (err || taskRows.length === 0) {
            console.error("Ошибка при получении задачи:", err?.message);
            return res.status(500).send("Ошибка сервера");
        }
        const title = taskRows[0].Title;
        completeTask(taskId, dateEnded, (err) => {
            if (err) {
                console.error("Ошибка при завершении задачи:", err.message);
                return res.status(500).send("Ошибка сервера");
            }
            getTaskExecutors(taskId, (err, executorRows) => {
                if (err) {
                    console.error("Ошибка при получении исполнителей:", err.message);
                    return;
                }
                executorRows.forEach((row) => {
                    const queryUser = 'SELECT id FROM users WHERE CONCAT(Surname, " ", Name, " ", Patronymic) = ?';
                    querySelect(queryUser, [row.executor], (err, userRows) => {
                        if (err || userRows.length === 0) {
                            console.error(`Пользователь ${row.executor} не найден`);
                            return;
                        }
                        const userId = userRows[0].id;
                        const message = `Задача "${title}" завершена.`;
                        sendNotification(userId, message);
                    });
                });
            });
            res.redirect("/");
        });
    });
});

router.post("/delete_task", (req, res) => {
    const { taskId } = req.body;
    console.log("[DEBUG] req.body для /delete_task:", req.body);
    querySelect('SELECT Title FROM tasks WHERE id = ?', [taskId], (err, taskRows) => {
        if (err || taskRows.length === 0) {
            console.error("Ошибка при получении задачи:", err?.message);
            return res.status(500).send("Ошибка сервера");
        }
        const title = taskRows[0].Title;
        getTaskExecutors(taskId, (err, executorRows) => {
            if (err) {
                console.error("Ошибка при получении исполнителей:", err.message);
                return res.status(500).send("Ошибка сервера");
            }
            executorRows.forEach((row) => {
                const queryUser = 'SELECT id FROM users WHERE CONCAT(Surname, " ", Name, " ", Patronymic) = ?';
                querySelect(queryUser, [row.executor], (err, userRows) => {
                    if (err || userRows.length === 0) {
                        console.error(`Пользователь ${row.executor} не найден`);
                        return;
                    }
                    const userId = userRows[0].id;
                    const message = `Задача "${title}" была удалена.`;
                    sendNotification(userId, message);
                });
            });
            deleteTask(taskId, (err) => {
                if (err) {
                    console.error("Ошибка при удалении задачи:", err.message);
                    return res.status(500).send("Ошибка сервера");
                }
                res.redirect("/");
            });
        });
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
            getTaskExecutors(taskId, (err, executorRows) => {
                if (err) {
                    console.error("Ошибка при получении исполнителей:", err.message);
                    return;
                }
                executorRows.forEach((row) => {
                    const queryUser = 'SELECT id FROM users WHERE CONCAT(Surname, " ", Name, " ", Patronymic) = ?';
                    querySelect(queryUser, [row.executor], (err, userRows) => {
                        if (err || userRows.length === 0) {
                            console.error(`Пользователь ${row.executor} не найден`);
                            return;
                        }
                        const userId = userRows[0].id;
                        const message = `Задача "${title}" была изменена. Новый дедлайн: ${new Date(endTime).toLocaleDateString()}.`;
                        sendNotification(userId, message);
                    });
                });
            });
            res.redirect("/");
        });
    } catch (err) {
        console.error("Ошибка в /edit_task:", err.message);
        res.status(500).send("Ошибка сервера");
    }
});

export { router };