import express from "express";
import { add_user, update_user, delete_user, get_users, get_tasks_creator, get_tasks_executer } from "../database/bd.js";
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

router.get("/", (req, res) => {
    const currentUser = res.locals.user;
    if (!currentUser) {
        console.error("Текущий пользователь не определён.");
        return res.status(401).send("Необходима авторизация");
    }
    const sortOrder = req.query.sort || "asc";
    const selectedUser = req.query.user || "all";
    const usersQuery = "SELECT Surname, Name, Patronymic, Login FROM users";
    get_users(usersQuery, [], (err, users) => {
        if (err) {
            console.error("Ошибка при загрузке пользователей:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        const filteredUsers = users.filter(user => user.Login !== currentUser.Login && user.Login !== "a");
        let executer = "";
        if (currentUser.Surname && currentUser.Name && currentUser.Patronymic) {
            executer = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
        }
        get_tasks_creator(currentUser.Login, (err, taskcreators) => {
            if (err) {
                console.error("Ошибка при получении задач создателя:", err.message);
                return res.status(500).send("Ошибка сервера");
            }
            get_tasks_executer(executer, (err, tasksinworks) => {
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
                    return sortOrder === "asc"
                        ? titleA.localeCompare(titleB)
                        : titleB.localeCompare(titleA);
                });
                res.render("main", { tasksinworks, users: filteredUsers, currentUser, taskcreators, sortOrder, selectedUser });
            });
        });
    });
});

router.get("/profile", (req, res) => {
    const currentUser = res.locals.user;
    if (!currentUser) {
        return res.redirect("/log_sign");
    }
    res.render("profile", { currentUser });
});

router.get("/add", (_, res) => {
    res.render("../views/add.ejs", { error: null });
});

router.post("/add", urlencodedParser, function (req, res) {
    const { login, surname, name, patronymic, post, role } = req.body;
    if (!login || !surname || !name || !patronymic || !post) {
        return res.render("add", { error: "Все поля должны быть заполнены" });
    }
    const query = "SELECT * FROM users WHERE login = ?";
    get_users(query, [login], (err, row) => {
        if (err) {
            console.error("Ошибка при выполнении запроса:", err.message);
            return res.render("add", { error: "Ошибка сервера" });
        }
        if (row.length > 0) {
            return res.render("add", { error: "Логин уже занят" });
        }
        const userRole = role === "on" ? "Admin" : "User";
        add_user(name, surname, patronymic, login, userRole, post);
        res.redirect(`/`);
    });
});

router.get("/edits", (req, res) => {
    const login = req.cookies.login;
    const query = "SELECT * FROM users WHERE Login = ?";
    get_users(query, [login], (err, rows) => {
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
    const query = "SELECT * FROM users WHERE login = ?";
    get_users(query, [login], (err, row) => {
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
        update_user(old_login, login, surname, name, patronymic, post, userRole, (err, changes) => {
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
    const query = "SELECT * FROM users WHERE login = ?";
    get_users(query, [req.body.login], (err, rows) => {
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
    const query = "SELECT * FROM users WHERE Login = ?";
    get_users(query, [login], (err, rows) => {
        if (err) {
            console.error("Ошибка при получении пользователя:", err.message);
            return res.render("del", { error: "Ошибка сервера" });
        }
        if (rows.length === 0) {
            return res.render("del", { error: "Пользователь не найден" });
        }
        const userId = rows[0].id;
        const userLogin = rows[0].Login;
        delete_user(userId, (err) => {
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