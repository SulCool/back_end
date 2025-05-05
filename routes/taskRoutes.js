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

    const startTimeUTC = startDate.toISOString();
    const endTimeUTC = endDate.toISOString();

    const now = new Date();
    if (endDate <= now) {
        console.log("[DEBUG] Ошибка: дата окончания должна быть в будущем");
        return loadDataAndRender(res, currentUser, req.query.sort || "asc", req.query.user || "all", "Дата окончания должна быть в будущем");
    }

    const selectedExecutors = Array.isArray(executors) ? executors.filter(e => e !== "") : (executors ? [executors] : []);
    console.log("[DEBUG] Выбранные исполнители:", selectedExecutors);

    if (selectedExecutors.length === 0) {
        console.log("[DEBUG] Ошибка: не выбран ни один исполнитель");
        return loadDataAndRender(res, currentUser, req.query.sort || "asc", req.query.user || "all", "Необходимо выбрать хотя бы одного исполнителя");
    }

    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const userName = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
    addTask(title, description, startTimeUTC, endTimeUTC, currentUser.Login, selectedExecutors, userName, filePath, type, (err, taskId) => {
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
                const message = `Вам назначена задача "${title}". Дедлайн: ${new Date(endTimeUTC).toLocaleDateString()}.`;
                sendNotification(userId, message);
            });
        });
        return res.redirect("/");
    });
});

function loadDataAndRender(res, currentUser, sortOrder, selectedUser, error) {
    if (res.headersSent) {
        console.error("[DEBUG] Заголовки уже отправлены, не могу рендерить страницу");
        return;
    }

    const validSortOrders = ["asc", "desc"];
    const validSortCriteria = ["title", "start", "end"];
    sortOrder = validSortOrders.includes(sortOrder) ? sortOrder : "asc";
    const sortBy = validSortCriteria.includes(res.req?.query?.sortBy) ? res.req.query.sortBy : "title";

    console.log("[DEBUG] loadDataAndRender: Начало загрузки данных");
    console.log("[DEBUG] sortOrder:", sortOrder, "sortBy:", sortBy, "selectedUser:", selectedUser, "error:", error);

    getUsers((err, users) => {
        if (err) {
            console.error("Ошибка при загрузке пользователей:", err.message);
            if (!res.headersSent) {
                res.status(500).send("Ошибка сервера");
            }
            return;
        }
        console.log("[DEBUG] Пользователи загружены:", users.length);
        const filteredUsers = users.filter(user => user.Login !== currentUser.Login && user.Login !== "a");
        
        let selectedUserFullName = null;
        if (selectedUser !== "all") {
            const selectedUserData = users.find(user => user.Login === selectedUser);
            if (selectedUserData) {
                selectedUserFullName = `${selectedUserData.Surname} ${selectedUserData.Name} ${selectedUserData.Patronymic}`;
            }
        }

        const executer = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
        getTasksByCreator(currentUser.Login, (err, taskcreators) => {
            if (err) {
                console.error("Ошибка при получении задач создателя:", err.message);
                if (!res.headersSent) {
                    res.status(500).send("Ошибка сервера");
                }
                return;
            }
            console.log("[DEBUG] Задачи создателя загружены:", taskcreators.length);
            getTasksByExecutor(executer, (err, tasksinworks) => {
                if (err) {
                    console.error("Ошибка при получении задач исполнителя:", err.message);
                    if (!res.headersSent) {
                        res.status(500).send("Ошибка сервера");
                    }
                    return;
                }
                console.log("[DEBUG] Задачи исполнителя загружены:", tasksinworks.length);

                const sortTasks = (tasks) => {
                    tasks.sort((a, b) => {
                        if (sortBy === "title") {
                            const titleA = (a.Title && a.Title.toLowerCase()) || "";
                            const titleB = (b.Title && b.Title.toLowerCase()) || "";
                            return sortOrder === "asc" 
                                ? titleA.localeCompare(titleB, "ru-RU") 
                                : titleB.localeCompare(titleA, "ru-RU");
                        } else if (sortBy === "start") {
                            const dateA = new Date(a.Date_start);
                            const dateB = new Date(b.Date_start);
                            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
                        } else if (sortBy === "end") {
                            const dateA = new Date(a.Date_end);
                            const dateB = new Date(b.Date_end);
                            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
                        }
                        return 0;
                    });
                };

                const loadExecutors = (tasks, cb) => {
                    let completed = 0;
                    if (tasks.length === 0) {
                        cb();
                        return;
                    }
                    tasks.forEach(task => {
                        getTaskExecutors(task.id, (err, executors) => {
                            task.executors = err ? [] : executors.map(e => e.executor);
                            completed++;
                            if (completed === tasks.length) cb();
                        });
                    });
                };

                loadExecutors(tasksinworks, () => {
                    loadExecutors(taskcreators, () => {
                        if (selectedUser !== "all" && selectedUserFullName) {
                            tasksinworks = tasksinworks.filter(task => task.executors.includes(selectedUserFullName));
                        }

                        if (selectedUser !== "all" && selectedUserFullName) {
                            taskcreators = taskcreators.filter(task => task.executors.includes(selectedUserFullName));
                        }

                        sortTasks(tasksinworks);
                        sortTasks(taskcreators);

                        if (!res.headersSent) {
                            console.log("[DEBUG] Рендеринг страницы main.ejs");
                            res.render("main", { tasksinworks, users: filteredUsers, currentUser, taskcreators, sortOrder, sortBy, selectedUser, error });
                        } else {
                            console.error("[DEBUG] Не могу рендерить, заголовки уже отправлены");
                        }
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
    const currentUser = res.locals.user;

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

    const startTimeUTC = startDate.toISOString();
    const endTimeUTC = endDate.toISOString();

    const now = new Date();
    if (endDate < now) {
        console.log("[DEBUG] Ошибка: дата окончания в прошлом");
        return loadDataAndRender(res, currentUser, req.query.sort || "asc", req.query.user || "all", "Дата окончания не может быть в прошлом");
    }

    let selectedExecutors;
    if (!executors) {
        selectedExecutors = [];
    } else if (Array.isArray(executors)) {
        selectedExecutors = executors.filter(e => e !== "");
    } else if (typeof executors === 'string') {
        selectedExecutors = executors.trim() === "" ? [] : [executors];
    } else {
        selectedExecutors = [];
    }
    console.log("[DEBUG] Выбранные исполнители:", selectedExecutors);

    if (selectedExecutors.length === 0) {
        console.log("[DEBUG] Ошибка: не выбран ни один исполнитель");
        return loadDataAndRender(res, currentUser, req.query.sort || "asc", req.query.user || "all", "Необходимо выбрать хотя бы одного исполнителя");
    }

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

        updateTask(taskId, title, description, startTimeUTC, endTimeUTC, selectedExecutors, filePath, type, (err) => {
            if (err) {
                console.error("Ошибка при обновлении задачи:", err.message);
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
                    const message = `Задача "${title}" была изменена. Новый дедлайн: ${new Date(endTimeUTC).toLocaleDateString()}.`;
                    sendNotification(userId, message);
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