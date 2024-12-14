import sqlite3 from "sqlite3";
let sql;
const db = new sqlite3.Database("./main.db", sqlite3.OPEN_READWRITE, (err) => {
    if(err) return console.error(err.message);
});

export function get_users(query, params, callback) {
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error("Ошибка выполнения запроса:", err.message);
            console.error("Ошибка базы данных:", err.message);
            callback(err, null);
        } else {
            callback(null, rows);
        }
    });
}
export function add_user(name = "name", surname = "surname", patronymic = "patronymic", login = "login", role = "role", post = "post") {
    sql = "INSERT INTO users(Login, Surname, Name, Patronymic, Role, Post) VALUES(?, ?, ?, ?, ?, ?)";
    db.run(sql, [login, surname, name, patronymic, role, post],
        (err) => {
            if (err) return console.error(err.message);
        }
    );
}
export function delete_user(id, callback) {
    const sql = "DELETE FROM users WHERE id = ?";
    db.run(sql, [id], function(err) {
        if (err) {
            console.error("Ошибка SQL при удалении пользователя:", err.message);
            return callback(err);
        }
        callback(null);
    });
}
export function update_user(oldLogin, newLogin, surname, name, patronymic, post, role, callback) {
    sql = `UPDATE users SET Login = ?, Surname = ?, Name = ?, Patronymic = ?, Role = ?, Post = ? WHERE Login = ?`;
    db.run(sql, [newLogin, surname, name, patronymic, role, post, oldLogin], function (err) {
        if (err) {
            console.error('Ошибка SQL при обновлении пользователя:', err.message);
            return callback(err, null);
        }
        callback(null, this.changes); 
    });
}
export function add_task(query, params, callback) {
    db.run(query, params, function (err) {
        if (err) {
            return callback(err);
        }
        callback(null, this.lastID);
    });
}
export function get_tasks_executer(user, callback) {
    const query = 'SELECT * FROM tasks WHERE Executer = ?';
    db.all(query, [user], (err,rows)=>{
        callback(err,rows);        
    });
}
export function get_tasks_creator(user, callback) {
    const query = 'SELECT * FROM tasks WHERE Creator = ?';
    db.all(query, [user], (err,rows)=>{
        callback(err,rows);        
    });
}
export function delete_task(taskId, callback) {
    const sql = "DELETE FROM tasks WHERE id = ?";
    db.run(sql, [taskId], function (err) {
        if (err) {
            console.error("Ошибка при удалении задачи:", err.message);
            return callback(err);
        }
        callback(null);
    });
}
export function complete_task(query, params, callback) {
    db.run(query, params, function (err) {
        callback(err);
    });
}