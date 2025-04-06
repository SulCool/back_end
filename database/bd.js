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

export function addTask(title, description, startTime, endTime, creator, executor, creatorName, filePath, callback) {
    const query = `
        INSERT INTO tasks (Title, Desc, Date_start, Date_end, Creator, Executer, Creator_name, File_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    queryRun(query, [title, description, startTime, endTime, creator, executor, creatorName, filePath], (err, lastID) => {
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