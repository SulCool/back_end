import { get_users } from "../database/bd.js";

export const authMiddleware = (req, res, next) => {
    if (req.path.startsWith("/download")) {
        return next();
    }

    const userLogin = req.cookies?.login;
    if (!userLogin) {
        res.locals.isAuthorized = false;
        return res.redirect("/log_sign"); 
    }

    const query = "SELECT * FROM users WHERE Login = ?";
    get_users(query, [userLogin], (err, rows) => {
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