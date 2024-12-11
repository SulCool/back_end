

const express = require('express');
const app = express();
const PORT = 3000;


app.use(express.static(__dirname + "/public"));

app.set('view engine', 'ejs');
app.set('views', __dirname + "/views");




app.get("/", (req, res) => {
    const tasks = [{title:"title",description:"description",deadline:"deadline",date:"date"}];
    res.render("main", {tasks:tasks});
});

app.get("/add", (_, response) => {
    response.sendFile(__dirname + "/views/add.html");
});
app.get("/profile", (_, response) => {
    response.sendFile(__dirname + "/views/profile.html");
});
app.get("/log_sign", (_, response) => {
    response.sendFile(__dirname + "/views/log_sign.html");
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

