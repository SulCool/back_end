import sqlite3 from "sqlite3";
let sql;

//connect db
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


//update
// sql = "UPDATE users SET name = ? WHERE id = ? ";
// db.run(sql,["Jake",1], (err) =>{
//     if(err) return console.error(err.message);
// })

//create tabl
// sql = "CREATE TABLE users(id INTEGER PRIMARY KEY, Login, Name, Surname, Patronymic,Role,Post)";
// db.run(sql);

//drop table
// sql = "DROP TABLE users";
// db.run(sql);

//insert
// sql = "INSERT INTO users(Login, Surname, Name, Patronymic, Role, Post) VALUES(?, ?, ?, ?, ?, ?)";
// db.run(sql, ["PGiZ5", "Progrev", "Iz", "Goev", "Admin", "Director"],
//     (err) => {
//         if(err) return console.error(err.message);
//     }
// );

//update
// sql = "UPDATE users SET name = ? WHERE id = ?";
// db.run(sql,[1],(err)=>{
//     if(err) return console.error(err.message);
// });

// sql = "DELETE FROM users WHERE id = ?";
// db.run(sql,[1],(err)=>{
//     if(err) return console.error(err.message);
// });


//select
// sql = "SELECT * FROM users";
// db.all(sql,[],(err,rows) => {
//     if (err) return console.error(err.message);
//     rows.forEach((rows) => {
//         console.log(rows);
//     });
// });