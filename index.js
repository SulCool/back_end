const express = require('express');
const app = express();
const PORT = 3000;
const urlencodedParser = express.urlencoded({extended: false});

app.use(express.static(__dirname + "/public"));

app.set('view engine', 'ejs');
app.set('views', __dirname + "/views");

app.get("/", (req, res) => {
    const tasks = [{title:"title",description:"description",deadline:"deadline",date:"date"}];
    const users = [{surname:"surname",name:"name",patronymic:"patronymic"}];
    res.render("main", {tasks:tasks, users:users});
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
    if(!req.body) return res.sendStatus(400);
    console.log(res.body);
    if(req.body.role === "on") req.body.role = "Admin";
    else req.body.role = "User";
    res.send(`${req.body.login} - ${req.body.role} - ${req.body.post} - ${req.body.name} - ${req.body.surname} - ${req.body.patronymic}`);
});

app.get("/profile", (_, res) => {
    const user = {name:"name",role:"role",post:"post"};
    res.render("profile", {user:user});
});

app.get("/log_sign", (_, res) => {
    res.sendFile(__dirname + "/views/log_sign.html");
});
app.post("/log_sign", urlencodedParser, function (req, res) {
    if(!req.body) return res.sendStatus(400);
    console.log(res.body);
    res.send(`${req.body.login}`);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

