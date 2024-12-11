const sqlite3 = require('sqlite3').verbose();
let sql;

//connect db
const db = new sqlite3.Database("./main.db", sqlite3.OPEN_READWRITE, (err) => {
    if(err) return console.error(err.message);
});

//update

// sql = "UPDATE users SET name = ? WHERE id = ? ";
// db.run(sql,["Jake",1], (err) =>{
//     if(err) return console.error(err.message);
// })

//create tabl
// sql = "CREATE TABLE users(id INTEGER PRIMARY KEY, login, Surname, Name, Patronymic, status, roule, post, avg_time)";
// db.run(sql);
//drop 

//insert
// sql = "INSERT INTO users(login, Surname, Name, Patronymic, status, roule, post, avg_time) VALUES(?, ?, ?, ?, ?, ?, ?, ?)";
// db.run(sql, ["admin", "admin", "admin", "admin", "admin", "admin", "admin", "admin"],
//     (err) => {
//         if(err) return console.error(err.message);
//     }
// );

// sql = "SELECT * FROM users";
// db.all(sql,[],(err,rows) => {
//     if (err) return console.error(err.message);
//     rows.forEach((rows) => {
//         console.log(rows);
//     });
// });