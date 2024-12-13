import sqlite3 from "sqlite3";
let sql;

const db = new sqlite3.Database("./main.db", sqlite3.OPEN_READWRITE, (err) => {
    if(err) return console.error(err.message);
});

export function get_users(query, params, callback) {
    db.all(query, params, (err, rows) => {
        if (err) {
            return callback(err, null);
        }
        callback(null, rows);
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
        console.log(`Пользователь с id=${id} удалён.`);
        callback(null);
    });
}

export function update_user(oldLogin, newLogin, surname, name, patronymic, post, role, callback) {
    console.log("Обновление пользователя:", oldLogin, newLogin, surname, name, patronymic, post, role);

    sql = `UPDATE users SET Login = ?, Surname = ?, Name = ?, Patronymic = ?, Role = ?, Post = ? WHERE Login = ?`;
    db.run(sql, [newLogin, surname, name, patronymic, role, post, oldLogin], function (err) {
        if (err) {
            console.error('Ошибка SQL при обновлении пользователя:', err.message);
            return callback(err, null);
        }

        console.log("SQL запрос выполнен, количество измененных строк:", this.changes);
        callback(null, this.changes); 
    });
}