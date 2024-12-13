import express from "express";
import { add_user } from "./bd.js";
import { get_users } from "./bd.js";
import cookieParser from "cookie-parser";
import { delete_user } from "./bd.js";
import { update_user } from "./bd.js";

const app = express();
const PORT = 3000;
const __dirname = import.meta.dirname;
const urlencodedParser = express.urlencoded({ extended: false });


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
    const tasks = [{ title: "title", description: "description", deadline: "deadline", date: "date" }];
    const users = [{ surname: "surname", name: "name", patronymic: "patronymic" }];
    const currentUser = res.locals.user;
    console.log("Текущий пользователь:", currentUser);
    res.render("main", { tasks, users, currentUser });
});

app.get("/edits", (req, res) => {
    const login = req.cookies.login;

    console.log("Текущий логин из cookies:", login);

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

    console.log("Полученные данные:", req.body);

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

        console.log("Логин уникален, начинаем обновление");

        update_user(old_login, login, surname, name, patronymic, post, userRole, (err, changes) => {
            if (err) {
                console.error('Ошибка при обновлении пользователя:', err.message);
                return res.render('edits', {
                    error: 'Ошибка сервера',
                    user: req.body
                });
            }

            console.log("Количество измененных строк:", changes);

            if (changes === 0) {
                return res.render('edits', {
                    error: 'Пользователь с таким логином не найден',
                    user: req.body
                });
            }

            res.cookie("login", login, { httpOnly: true });
            res.redirect("/");
        });
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

app.post("/add_task", urlencodedParser, function (req, res) {
    if (!req.body) return res.sendStatus(400);
    console.log(res.body);
    res.send(`${req.body.title} - ${req.body.description} - ${req.body.date} - ${req.body.deadline} - ${req.body.name}`);
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

            console.log("Пользователь удалён:", userLogin);

            if (req.cookies.login === userLogin) {
                res.clearCookie("login");
                return res.redirect("/log_sign");
            }

            res.redirect("/");
        });
    });
});
app.get("/logout", (req, res) => {
    res.clearCookie("login"); 
    res.redirect("/log_sign"); 
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
