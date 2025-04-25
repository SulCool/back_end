import express from "express";
import { getUsers, getUserByLogin, addUser, updateUser, deleteUser, getTasksByCreator, getTasksByExecutor, getTaskStatsByCreator, getTaskStatsByExecutor, getTaskExecutors, getTaskFilePath } from "../database/bd.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const urlencodedParser = express.urlencoded({ extended: false });
const router = express.Router();

router.get("*", (req, res, next) => {
    console.log(`[DEBUG userRoutes] GET-запрос на: ${req.path}`);
    next();
});

router.get("/download/:filename", (req, res) => {
    const filename = req.params.filename;
    console.log(`[DEBUG] Запрос на скачивание файла: ${filename}`);

    getTaskFilePath(filename, (err, task) => {
        if (err) {
            console.error("Ошибка при поиске файла в базе данных:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        if (!task || !task.File_path) {
            console.log(`[DEBUG] Файл ${filename} не найден в базе данных`);
            return res.status(404).send("Файл не найден");
        }

        const filePath = path.join(__dirname, "..", task.File_path);
        console.log(`[DEBUG] Путь к файлу: ${filePath}`);

        res.sendFile(filePath, (err) => {
            if (err) {
                console.error("Ошибка при отправке файла:", err.message);
                return res.status(404).send("Файл не найден на сервере");
            }
        });
    });
});

router.get("/", (req, res) => {
    const currentUser = res.locals.user;
    if (!currentUser) {
        console.error("Текущий пользователь не определён.");
        return res.status(401).send("Необходима авторизация");
    }

    const validSortOrders = ["asc", "desc"];
    const validSortCriteria = ["title", "start", "end"];
    const sortOrder = validSortOrders.includes(req.query.sort) ? req.query.sort : "asc";
    const sortBy = validSortCriteria.includes(req.query.sortBy) ? req.query.sortBy : "title";
    const selectedUser = req.query.user || "all";

    getUsers((err, users) => {
        if (err) {
            console.error("Ошибка при загрузке пользователей:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        const filteredUsers = users.filter(user => user.Login !== currentUser.Login && user.Login !== "a");
        let executer = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
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

                sortTasks(tasksinworks);
                sortTasks(taskcreators);

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
                        res.render("main", { tasksinworks, users: filteredUsers, currentUser, taskcreators, sortOrder, sortBy, selectedUser });
                    });
                });
            });
        });
    });
});

router.get("/profile", (req, res) => {
    const currentUser = res.locals.user;
    if (!currentUser) {
        return res.redirect("/log_sign");
    }

    const executorName = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
    getTaskStatsByCreator(currentUser.Login, (err, creatorStats) => {
        if (err) {
            console.error("Ошибка при загрузке статистики создателя:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        getTaskStatsByExecutor(executorName, (err, executorStats) => {
            if (err) {
                console.error("Ошибка при загрузке статистики исполнителя:", err.message);
                return res.status(500).send("Ошибка сервера");
            }

            res.render("profile", { 
                currentUser, 
                creatorStats, 
                executorStats 
            });
        });
    });
});

router.get("/add", (_, res) => {
    res.render("../views/add.ejs", { error: null });
});

router.post("/add", urlencodedParser, function (req, res) {
    const { login, surname, name, patronymic, post, role } = req.body;
    if (!login || !surname || !name || !patronymic || !post) {
        return res.render("add", { error: "Все поля должны быть заполнены" });
    }
    getUserByLogin(login, (err, row) => {
        if (err) {
            console.error("Ошибка при выполнении запроса:", err.message);
            return res.render("add", { error: "Ошибка сервера" });
        }
        if (row.length > 0) {
            return res.render("add", { error: "Логин уже занят" });
        }
        const userRole = role === "on" ? "Admin" : "User";
        addUser(name, surname, patronymic, login, userRole, post, (err) => {
            if (err) {
                console.error("Ошибка при добавлении пользователя:", err.message);
                return res.render("add", { error: "Ошибка сервера" });
            }
            res.redirect(`/`);
        });
    });
});

router.get("/edits", (req, res) => {
    const login = req.cookies.login;
    getUserByLogin(login, (err, rows) => {
        if (err) {
            console.error("Ошибка при получении данных пользователя:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        if (rows.length > 0) {
            const user = rows[0];
            res.render("edits", { user, old_login: user.Login });
        } else {
            res.redirect("/");
        }
    });
});

router.post("/edits", urlencodedParser, (req, res) => {
    const { old_login, login, surname, name, patronymic, post, role } = req.body;
    if (!old_login || !login || !surname || !name || !patronymic || !post) {
        return res.render("edits", {
            error: "Все поля должны быть заполнены",
            user: req.body
        });
    }
    const userRole = role === "on" ? "Admin" : "User";
    getUserByLogin(login, (err, row) => {
        if (err) {
            console.error("Ошибка при выполнении запроса:", err.message);
            return res.render("edits", {
                error: "Ошибка сервера",
                user: req.body
            });
        }
        if (row.length > 0 && row[0].login !== old_login) {
            return res.render("edits", {
                error: "Логин уже занят",
                user: req.body
            });
        }
        updateUser(old_login, login, surname, name, patronymic, post, userRole, (err, changes) => {
            if (err) {
                console.error("Ошибка при обновлении пользователя:", err.message);
                return res.render("edits", {
                    error: "Ошибка сервера",
                    user: req.body
                });
            }
            if (changes === 0) {
                return res.render("edits", {
                    error: "Пользователь с таким логином не найден",
                    user: req.body
                });
            }
            res.redirect("/");
        });
    });
});

router.get("/log_sign", (_, res) => {
    res.render("log_sign", { error: null });
});

router.post("/log_sign", urlencodedParser, (req, res) => {
    if (!req.body || !req.body.login || req.body.login.trim() === "") {
        return res.render("log_sign", { error: "Введите логин" });
    }
    res.clearCookie("login");
    getUserByLogin(req.body.login, (err, rows) => {
        if (err || rows.length === 0) {
            return res.render("log_sign", { error: "Неправильный логин" });
        }
        res.cookie("login", req.body.login, { httpOnly: true });
        res.redirect("/");
    });
});

router.get("/logout", (req, res) => {
    res.clearCookie("login");
    res.redirect("/log_sign");
});

router.get("/del", (req, res) => {
    res.render("del");
});

router.post("/del", urlencodedParser, (req, res) => {
    const { login } = req.body;
    if (!login) {
        return res.render("del", { error: "Логин не указан" });
    }
    getUserByLogin(login, (err, rows) => {
        if (err) {
            console.error("Ошибка при получении пользователя:", err.message);
            return res.render("del", { error: "Ошибка сервера" });
        }
        if (rows.length === 0) {
            return res.render("del", { error: "Пользователь не найден" });
        }
        const userId = rows[0].id;
        const userLogin = rows[0].Login;
        deleteUser(userId, (err) => {
            if (err) {
                console.error("Ошибка при удалении пользователя:", err.message);
                return res.render("del", { error: "Не удалось удалить пользователя" });
            }
            if (req.cookies.login === userLogin) {
                res.clearCookie("login");
                return res.redirect("/log_sign");
            }
            res.redirect("/");
        });
    });
});

export { router as userRoutes };