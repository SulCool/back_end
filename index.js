import express from "express";
import { get_users, update_user, delete_user, add_user, add_task, get_tasks_creator, get_tasks_executer, delete_task, complete_task } from "./bd.js";
import cookieParser from "cookie-parser";

export const app = express();
const PORT = 3000;
export const __dirname = import.meta.dirname;
export const urlencodedParser = express.urlencoded({ extended: false });

app.use(cookieParser());
app.use(express.static(__dirname + "/public"));
app.set('view engine', 'ejs');
app.set('views', __dirname + "/views");

app.use((req, res, next) => {
    const userLogin = req.cookies?.login;
    if (!userLogin) {
        res.locals.isAuthorized = false;
        return next();
    }
    const query = 'SELECT * FROM users WHERE Login = ?';
    get_users(query, [userLogin], (err, rows) => {
        if (err || rows.length === 0) {
            res.locals.isAuthorized = false;
            res.clearCookie("login");
            return next();
        }
        const user = rows[0];
        res.locals.isAuthorized = true;
        res.locals.user = user;
        next();
    });
});

app.get("/", (req, res) => {
    const currentUser = res.locals.user;
    const sortOrder = req.query.sort || 'asc';
    const selectedUser = req.query.user || 'all';  
    const usersQuery = "SELECT Surname, Name, Patronymic, Login FROM users";
    get_users(usersQuery, [], (err, users) => {
        if (err) {
            console.error("Ошибка при загрузке пользователей:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        let executer = "";
        if (currentUser && currentUser.Surname && currentUser.Name && currentUser.Patronymic) {
            executer = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
        }
        get_tasks_creator(currentUser.Login, (err, taskcreators) => {
            get_tasks_executer(executer, (err, tasksinworks) => {
                if (err) {
                    console.error("Ошибка при получении задач исполнителя:", err.message);
                    return res.status(500).send("Ошибка при получении задач");
                }
                if (selectedUser !== 'all') {
                    tasksinworks = tasksinworks.filter(tasksinworks => tasksinworks.Creator === selectedUser);
                }
                tasksinworks.sort((a, b) => {
                    const titleA = (a.Title && a.Title.toLowerCase()) || '';
                    const titleB = (b.Title && b.Title.toLowerCase()) || '';
                    if (sortOrder === 'asc') {
                        return titleA.localeCompare(titleB);
                    } else {
                        return titleB.localeCompare(titleA);
                    }
                });
                res.render("main", { tasksinworks, users, currentUser, taskcreators, sortOrder, selectedUser });
            });
        });
    });
});



app.get("/profile", (req, res) => {
    const currentUser = res.locals.user;
    if (!currentUser) {
        return res.redirect("/log_sign");
    }
    res.render("profile", { currentUser });
});

app.get("/log_sign", (_, res) => {
    res.render("log_sign", { error: null });
});
app.post("/log_sign", urlencodedParser, (req, res) => {
    if (!req.body || !req.body.login || req.body.login.trim() === "") {
        return res.render('log_sign', { error: "Введите логин" });
    }
    res.clearCookie("login");
    const query = 'SELECT * FROM users WHERE login = ?';
    get_users(query, [req.body.login], (err, rows) => {
        if (err || rows.length === 0) {
            return res.render('log_sign', { error: "Неправильный логин" });
        }
        res.cookie("login", req.body.login, { httpOnly: true });
        res.redirect("/");
    });
});

app.get("/edits", (req, res) => {
    const login = req.cookies.login;
    const query = 'SELECT * FROM users WHERE Login = ?';
    get_users(query, [login], (err, rows) => {
        if (err) {
            console.error('Ошибка при получении данных пользователя:', err.message);
            return res.status(500).send('Ошибка сервера');
        }
        if (rows.length > 0) {
            const user = rows[0];
            res.render('edits', { user, old_login: user.Login });
        } else {
            res.redirect('/');
        }
    });
});

app.post("/edits", urlencodedParser, (req, res) => {
    const { old_login, login, surname, name, patronymic, post, role } = req.body;
    if (!old_login || !login || !surname || !name || !patronymic || !post) {
        return res.render('edits', {
            error: 'Все поля должны быть заполнены',
            user: req.body
        });
    }
    const userRole = role === "on" ? "Admin" : "User";
    const query = 'SELECT * FROM users WHERE login = ?';
    get_users(query, [login], (err, row) => {
        if (err) {
            console.error('Ошибка при выполнении запроса:', err.message);
            return res.render('edits', {
                error: 'Ошибка сервера',
                user: req.body
            });
        }
        if (row.length > 0 && row[0].login !== old_login) {
            return res.render('edits', {
                error: 'Логин уже занят',
                user: req.body
            });
        }
        update_user(old_login, login, surname, name, patronymic, post, userRole, (err, changes) => {
            if (err) {
                console.error('Ошибка при обновлении пользователя:', err.message);
                return res.render('edits', {
                    error: 'Ошибка сервера',
                    user: req.body
                });
            }
            if (changes === 0) {
                return res.render('edits', {
                    error: 'Пользователь с таким логином не найден',
                    user: req.body
                });
            }
            res.redirect("/");
        });
    });
});

app.get("/del", (req, res) => {
    res.render("del");
});
app.post("/del", urlencodedParser, (req, res) => {
    const { login } = req.body;
    if (!login) {
        return res.render("del", { error: "Логин не указан" });
    }
    const query = 'SELECT * FROM users WHERE Login = ?';
    get_users(query, [login], (err, rows) => {
        if (err) {
            console.error('Ошибка при получении пользователя:', err.message);
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

app.post("/add_task", urlencodedParser, (req, res) => {
    const { title, description, 'start-time': startTime, 'end-time': endTime, executor } = req.body;
    const currentUser = res.locals.user;
    if (!title || !description || !startTime || !endTime || !executor) {
        return res.status(400).send("Все поля должны быть заполнены");
    }
    const addTaskQuery = `
        INSERT INTO tasks (title, Desc, Date_start, Date_end, creator, executer, Creator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const userName = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
    add_task(addTaskQuery, [title, description, startTime, endTime, currentUser.Login, executor, userName], (err) => {
        if (err) {
            console.error("Ошибка при добавлении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        return res.redirect("/");
    });
});
app.get("/add", (_, res) => {
    res.sendFile(__dirname + "/views/add.html");
});
app.post("/add", urlencodedParser, function (req, res) {
    const { login, surname, name, patronymic, post, role } = req.body;
    if (!login || !surname || !name || !patronymic || !post) {
        return res.render('add', { error: 'Все поля должны быть заполнены' });
    }
    const query = 'SELECT * FROM users WHERE login = ?';
    get_users(query, [login], (err, row) => {
        if (err) {
            console.error('Ошибка при выполнении запроса:', err.message);
            return res.render('add', { error: 'Ошибка сервера' });
        }
        if (row.length > 0) {
            return res.render('add', { error: 'Логин уже занят' });
        }
        const userRole = role === "on" ? "Admin" : "User";
        add_user(name, surname, patronymic, login, userRole, post);
        res.redirect(`/`);
    });
});

app.get("/logout", (req, res) => {
    res.clearCookie("login");
    res.redirect("/log_sign");
});

app.post("/delete_task", urlencodedParser, (req, res) => {
    const { taskId } = req.body;
    if (!taskId) {
        return res.status(400).send("ID задачи не указан");
    }
    delete_task(taskId, (err) => {
        if (err) {
            console.error("Ошибка при удалении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        res.redirect("/");
    });
});

app.post("/complete_task", urlencodedParser, (req, res) => {
    const { taskId } = req.body;
    const query = "UPDATE tasks SET date_ended = ? WHERE id = ?";
    const dateEnded = new Date().toISOString();

    complete_task(query, [dateEnded, taskId], (err) => {
        if (err) {
            console.error("Ошибка при завершении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        res.redirect("/");
    });
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
