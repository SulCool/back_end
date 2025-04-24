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

    // Проверка обязательных полей
    if (!title?.trim() || !description?.trim() || !startTime || !endTime || !type?.trim()) {
        console.log("[DEBUG] Ошибка: не все обязательные поля заполнены");
        return loadDataAndRender(res, currentUser, req.query.sort || "asc", req.query.user || "all", "Все поля, кроме исполнителей, должны быть заполнены");
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.log("[DEBUG] Ошибка: некорректный формат даты");
        return loadDataAndRender(res, currentUser, req.query.sort || "asc", req.query.user || "all", "Некорректный формат даты");
    }

    // Обработка исполнителей
    const selectedExecutors = Array.isArray(executors) ? executors.filter(e => e !== "") : [];
    console.log("[DEBUG] Выбранные исполнители:", selectedExecutors);

    // Проверка, что выбран хотя бы один исполнитель
    if (selectedExecutors.length === 0) {
        console.log("[DEBUG] Ошибка: не выбран ни один исполнитель");
        return loadDataAndRender(res, currentUser, req.query.sort || "asc", req.query.user || "all", "Необходимо выбрать хотя бы одного исполнителя");
    }

    // Проверка, что пользователь не назначает задачу самому себе
    if (selectedExecutors.includes(currentUser.Login)) {
        return loadDataAndRender(res, currentUser, req.query.sort || "asc", req.query.user || "all", "Вы не можете назначить задачу самому себе");
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

function loadDataAndRender(res, currentUser, sortOrder, selectedUser, error) {
    getUsers((err, users) => {
        if (err) {
            console.error("Ошибка при загрузке пользователей:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        const filteredUsers = users.filter(user => user.Login !== currentUser.Login && user.Login !== "a");
        const executer = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
        getTasksByCreator(currentUser.Login, (err, taskcreators) => {
            if (err) {
                console.error("Ошибка при получении задач создателя:", err.message);
                return res.status(500).send("Ошибка сервера");
            }
            getTasksByExecutor(executer, (err, tasksinworks) => {
                if (err) {
                    console.error("Ошибка при получении задач исполнителя:", err.message);
                    return res.status(500).send("Ошибка сервера");
                }
                if (selectedUser !== "all") {
                    tasksinworks = tasksinworks.filter(task => task.Creator === selectedUser);
                }
                tasksinworks.sort((a, b) => {
                    const titleA = (a.Title && a.Title.toLowerCase()) || "";
                    const titleB = (b.Title && b.Title.toLowerCase()) || "";
                    return sortOrder === "asc" ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
                });
                const loadExecutors = (tasks, cb) => {
                    let completed = 0;
                    tasks.forEach(task => {
                        getTaskExecutors(task.id, (err, executors) => {
                            task.executors = err ? [] : executors.map(e => e.executor);
                            completed++;
                            if (completed === tasks.length) cb();
                        });
                    });
                    if (tasks.length === 0) cb();
                };
                loadExecutors(tasksinworks, () => {
                    loadExecutors(taskcreators, () => {
                        res.render("main", { tasksinworks, users: filteredUsers, currentUser, taskcreators, sortOrder, selectedUser, error });
                    });
                });
            });
        });
    });
}

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