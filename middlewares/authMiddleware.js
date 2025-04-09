import { getUserByLogin } from "../database/bd.js";

export const authMiddleware = (req, res, next) => {
    console.log("[DEBUG authMiddleware] Путь запроса:", req.path);
    if (req.path.startsWith("/download")) {
        console.log("[DEBUG authMiddleware] Пропускаем проверку для /download");
        return next();
    }

    const userLogin = req.cookies?.login;
    console.log("[DEBUG authMiddleware] Логин из куки:", userLogin);
    if (!userLogin) {
        res.locals.isAuthorized = false;
        console.log("[DEBUG authMiddleware] Логин не найден, перенаправляем на /log_sign");
        return res.redirect("/log_sign");
    }

    getUserByLogin(userLogin, (err, rows) => {
        if (err || rows.length === 0) {
            res.locals.isAuthorized = false;
            res.clearCookie("login");
            console.log("[DEBUG authMiddleware] Пользователь не найден, перенаправляем на /log_sign");
            return res.redirect("/log_sign");
        }

        const user = rows[0];
        res.locals.isAuthorized = true;
        res.locals.user = user;
        console.log("[DEBUG authMiddleware] Пользователь авторизован:", user.Login);
        next();
    });
};