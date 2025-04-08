import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./main.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message);
});

export function querySelect(query, params, callback) {
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error("Ошибка выполнения запроса:", err.message);
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });
}

export function queryRun(query, params, callback) {
    db.run(query, params, function (err) {
        if (err) {
            console.error("Ошибка выполнения запроса:", err.message);
            callback(err);
        } else {
            callback(null, this.lastID || this.changes);
        }
    });
}

export function getUsers(callback) {
    const query = "SELECT Surname, Name, Patronymic, Login FROM users";
    querySelect(query, [], callback);
}

export function getUserByLogin(login, callback) {
    const query = "SELECT * FROM users WHERE Login = ?";
    querySelect(query, [login], callback);
}

export function addUser(name, surname, patronymic, login, role, post, callback) {
    const query = "INSERT INTO users (Login, Surname, Name, Patronymic, Role, Post) VALUES (?, ?, ?, ?, ?, ?)";
    queryRun(query, [login, surname, name, patronymic, role, post], (err) => {
        if (err) {
            console.error("Ошибка при добавлении пользователя:", err.message);
            callback(err);
        } else {
            callback(null);
        }
    });
}

export function deleteUser(id, callback) {
    const query = "DELETE FROM users WHERE id = ?";
    queryRun(query, [id], callback);
}

export function updateUser(oldLogin, newLogin, surname, name, patronymic, post, role, callback) {
    const query = `UPDATE users SET Login = ?, Surname = ?, Name = ?, Patronymic = ?, Role = ?, Post = ? WHERE Login = ?`;
    queryRun(query, [newLogin, surname, name, patronymic, role, post, oldLogin], (err, changes) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, changes);
        }
    });
}

export function addTask(title, description, startTime, endTime, creator, executor, creatorName, filePath, type, callback) {
    const query = `
        INSERT INTO tasks (Title, Desc, Date_start, Date_end, Creator, Executer, Creator_name, File_path, Type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    queryRun(query, [title, description, startTime, endTime, creator, executor, creatorName, filePath, type], (err, lastID) => {
        if (err) {
            callback(err);
        } else {
            callback(null, lastID);
        }
    });
}

export function getTasksByExecutor(user, callback) {
    const query = "SELECT * FROM tasks WHERE Executer = ?";
    querySelect(query, [user], callback);
}

export function getTasksByCreator(user, callback) {
    const query = "SELECT * FROM tasks WHERE Creator = ?";
    querySelect(query, [user], callback);
}

export function getTaskFilePath(filename, callback) {
    const query = "SELECT File_path FROM tasks WHERE File_path LIKE ? LIMIT 1";
    querySelect(query, [`%/uploads/${filename}`], (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, rows.length > 0 ? rows[0] : null);
        }
    });
}

export function getTaskById(taskId, callback) {
    const query = "SELECT File_path FROM tasks WHERE id = ?";
    querySelect(query, [taskId], (err, rows) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, rows.length > 0 ? rows[0] : null);
        }
    });
}

export function deleteTask(taskId, callback) {
    const query = "DELETE FROM tasks WHERE id = ?";
    queryRun(query, [taskId], callback);
}

export function completeTask(taskId, dateEnded, callback) {
    const query = "UPDATE tasks SET Date_ended = ? WHERE id = ?";
    queryRun(query, [dateEnded, taskId], callback);
}

export function getAllTasks(callback) {
    const query = "SELECT * FROM tasks";
    querySelect(query, [], callback);
}

export function updateTask(taskId, title, description, startTime, endTime, executor, filePath, type, callback) {
    const dateUpdated = new Date().toISOString();
    const query = `
        UPDATE tasks 
        SET Title = ?, Desc = ?, Date_start = ?, Date_end = ?, Executer = ?, File_path = ?, Date_updated = ?, Type = ?
        WHERE id = ?
    `;
    queryRun(query, [title, description, startTime, endTime, executor, filePath, dateUpdated, type, taskId], (err, changes) => {
        if (err) {
            console.error("Ошибка при обновлении задачи:", err.message);
            callback(err, null);
        } else if (changes === 0) {
            callback(new Error("Задача с таким ID не найдена"), null);
        } else {
            callback(null, changes);
        }
    });
}

export function getTaskStatsByCreator(login, callback) {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoISO = monthAgo.toISOString();

    const query = `
        SELECT 
            (SELECT COUNT(*) FROM tasks WHERE Creator = ?) as totalCreated,
            (SELECT COUNT(*) FROM tasks WHERE Creator = ? AND Date_ended IS NOT NULL) as totalCompleted,
            (SELECT COUNT(*) FROM tasks WHERE Creator = ? AND Date_start >= ?) as monthCreated,
            (SELECT COUNT(*) FROM tasks WHERE Creator = ? AND Date_ended >= ?) as monthCompleted
    `;
    querySelect(query, [login, login, login, monthAgoISO, login, monthAgoISO], (err, rows) => {
        if (err) {
            console.error("Ошибка при получении статистики задач:", err.message);
            callback(err, null);
        } else {
            const stats = rows[0] || {
                totalCreated: 0,
                totalCompleted: 0,
                monthCreated: 0,
                monthCompleted: 0
            };
            callback(null, stats);
        }
    });
}

export function getTaskStatsByExecutor(executorName, callback) {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoISO = monthAgo.toISOString();

    const query = `
        SELECT 
            (SELECT COUNT(*) FROM tasks WHERE Executer = ?) as totalAssigned,
            (SELECT COUNT(*) FROM tasks WHERE Executer = ? AND Date_ended IS NOT NULL) as totalCompleted,
            (SELECT COUNT(*) FROM tasks WHERE Executer = ? AND Date_start >= ?) as monthAssigned,
            (SELECT COUNT(*) FROM tasks WHERE Executer = ? AND Date_ended >= ?) as monthCompleted
    `;
    querySelect(query, [executorName, executorName, executorName, monthAgoISO, executorName, monthAgoISO], (err, rows) => {
        if (err) {
            console.error("Ошибка при получении статистики задач исполнителя:", err.message);
            callback(err, null);
        } else {
            const stats = rows[0] || {
                totalAssigned: 0,
                totalCompleted: 0,
                monthAssigned: 0,
                monthCompleted: 0
            };
            callback(null, stats);
        }
    });
}