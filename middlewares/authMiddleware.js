import { getUserByLogin } from "../database/bd.js";

export const authMiddleware = (req, res, next) => {
    if (req.path.startsWith("/download")) {
        return next();
    }

    const userLogin = req.cookies?.login;
    if (!userLogin) {
        res.locals.isAuthorized = false;
        return res.redirect("/log_sign");
    }

    getUserByLogin(userLogin, (err, rows) => {
        if (err || rows.length === 0) {
            res.locals.isAuthorized = false;
            res.clearCookie("login");
            return res.redirect("/log_sign");
        }

        const user = rows[0];
        res.locals.isAuthorized = true;
        res.locals.user = user;
        next();
    });
};