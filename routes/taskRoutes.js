import { Router } from "express";
import { upload } from "../multerConfig.js";
import { addTask, completeTask, deleteTask, updateTask } from "../database/bd.js";

const router = Router();


router.post("/add_task", upload.single("file"), (req, res) => {
    console.log("[DEBUG] req.body после multer:", req.body);

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

    if (!title?.trim() || !description?.trim() || !startTime || !endTime || !type?.trim()) {
        console.log("[DEBUG] Ошибка: не все обязательные поля заполнены");
        return res.status(400).send("Все поля, кроме исполнителей, должны быть заполнены");
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.log("[DEBUG] Ошибка: некорректный формат даты");
        return res.status(400).send("Некорректный формат даты");
    }

    const selectedExecutors = Array.isArray(executors) ? executors.filter(e => e !== "") : [];
    console.log("[DEBUG] Выбранные исполнители:", selectedExecutors);

    if (selectedExecutors.includes(currentUser.Login)) {
        return res.status(400).send("Вы не можете назначить задачу самому себе");
    }
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const userName = `${currentUser.Surname} ${currentUser.Name} ${currentUser.Patronymic}`;
    addTask(title, description, startTime, endTime, currentUser.Login, selectedExecutors, userName, filePath, type, (err) => {
        if (err) {
            console.error("Ошибка при добавлении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        return res.redirect("/");
    });
});

router.post("/complete_task", (req, res) => {
    const { taskId } = req.body;
    completeTask(taskId, (err) => {
        if (err) {
            console.error("Ошибка при завершении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        res.redirect("/");
    });
});

router.post("/delete_task", (req, res) => {
    const { taskId } = req.body;
    console.log("[DEBUG] req.body для /delete_task:", req.body);
    deleteTask(taskId, (err) => {
        if (err) {
            console.error("Ошибка при удалении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        res.redirect("/");
    });
});


router.post("/edit_task", upload.single("file"), (req, res) => {
    console.log("[DEBUG] req.body для /edit_task:", req.body);
    const { taskId, title, description, "start-time": startTime, "end-time": endTime, executors, type } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    const selectedExecutors = Array.isArray(executors) ? executors.filter(e => e !== "") : [];
    updateTask(taskId, title, description, startTime, endTime, selectedExecutors, filePath, type, (err) => {
        if (err) {
            console.error("Ошибка при обновлении задачи:", err.message);
            return res.status(500).send("Ошибка сервера");
        }
        res.redirect("/");
    });
});

export { router };