import express from "express";
import { add_task, delete_task, complete_task } from "../database/bd.js";
export const urlencodedParser = express.urlencoded({ extended: false });
const router = express.Router();

router.post("/add_task", urlencodedParser, (req, res) => {
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

router.post("/delete_task", urlencodedParser, (req, res) => {
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

router.post("/complete_task", urlencodedParser, (req, res) => {
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

export { router as taskRoutes };