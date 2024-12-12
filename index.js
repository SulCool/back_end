import express from "express";
import { add_user } from "./bd.js";
import { get_users } from "./bd.js";
import cookieParser from "cookie-parser";

const app = express();
const PORT = 3000;
const __dirname = import.meta.dirname;
const urlencodedParser = express.urlencoded({extended: false});


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

    const query = 'SELECT * FROM users WHERE login = ?';
    get_users(query, [userLogin], (err, rows) => {
        if (err || rows.length === 0) {
            res.locals.isAuthorized = false;
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

app.get("/edits", (_, res) => {
    const user = {login:"login",role:"role",post:"post",surname:"surname",name:"name",patronymic:"patronymic"};
    res.render("edits", {user:user});
});

app.post("/edits", urlencodedParser, function (req, res) {
    if(!req.body) return res.sendStatus(400);
    console.log(res.body);
    if(req.body.role === "on") req.body.role = "Admin";
    else req.body.role = "User";
    res.send(`${req.body.login} - ${req.body.role} - ${req.body.post} - ${req.body.surname} -  ${req.body.name} - ${req.body.patronymic}`);
});

app.get("/add", (_, res) => {
    res.sendFile(__dirname + "/views/add.html");
});

app.post("/add", urlencodedParser, function (req, res) {
    const q = 'SELECT * FROM users WHERE login = ?';
    get_users(q, [req.body.login], (err, row) => {
        if (err) {
            console.error('Ошибка при выполнении запроса:', err.message);
            return res.render('add',{error: 'Ошибка сервера'});
          }
      
          if (row.length > 0) {
            if(!req.body) return res.sendStatus(400);
            console.log(res.body);
            if(req.body.role === "on") req.body.role = "Admin";
            else req.body.role = "User";
            add_user(req.body.login, req.body.surname, req.body.name, req.body.patronymic, req.body.role, req.body.post);
            res.redirect(`/`);
          } else {
            res.render('add', { error: 'Неправильный логин' });
          }
    })
});

app.post("/add_task", urlencodedParser, function (req, res) {
    if(!req.body) return res.sendStatus(400);
    console.log(res.body);
    res.send(`${req.body.title} - ${req.body.description} - ${req.body.date} - ${req.body.deadline} - ${req.body.name}`);
});

app.get("/profile", (_, res) => {
    const user = {name:"name",role:"role",post:"post"};
    res.render("profile", {user:user});
});

app.get("/log_sign", (_, res) => {
    res.sendFile(__dirname + "/views/log_sign.html");
});
app.post("/log_sign", urlencodedParser, (req, res) => {
    if (!req.body || !req.body.login) return res.sendStatus(400);
    const query = 'SELECT * FROM users WHERE login = ?';
    get_users(query, [req.body.login], (err, rows) => {
        if (err || rows.length === 0) {
            return res.render('log_sign', { error: "Неправильный логин" });
        }
        res.cookie("login", req.body.login, { httpOnly: true });
        res.redirect("/");
    });
});

app.get("/logout", (req, res) => {
    res.clearCookie("login");
    res.redirect("/");
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
