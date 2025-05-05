import TelegramBot from 'node-telegram-bot-api';
import { queryRun, querySelect, getUserByLogin } from './database/bd.js';

const token = '7659395380:AAHuCFHNlF5CoxsaNgFecMbwQHvkrP2zkTU';
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const login = match[1];

    getUserByLogin(login, (err, rows) => {
        if (err || rows.length === 0) {
            bot.sendMessage(chatId, 'Пользователь с таким логином не найден.');
            return;
        }

        const user = rows[0];
        const query = 'INSERT OR REPLACE INTO telegram_users (user_id, chat_id) VALUES (?, ?)';
        queryRun(query, [user.id, chatId], (err) => {
            if (err) {
                console.error('Ошибка при сохранении chatId:', err.message);
                bot.sendMessage(chatId, 'Ошибка сервера. Попробуй позже.');
                return;
            }
            bot.sendMessage(chatId, `Ты зарегистрирован, ${user.Surname} ${user.Name}! Теперь я буду уведомлять тебя о задачах.`);
        });
    });
});

export function sendNotification(userId, message) {
    const query = 'SELECT chat_id FROM telegram_users WHERE user_id = ?';
    querySelect(query, [userId], (err, rows) => {
        if (err) {
            console.error('Ошибка при получении chatId:', err.message);
            return;
        }
        if (rows.length === 0) {
            console.log(`Нет chatId для userId ${userId}`);
            return;
        }
        const chatId = rows[0].chat_id;
        bot.sendMessage(chatId, message).catch((error) => {
            console.error('Ошибка при отправке сообщения:', error.message);
        });
    });
}

export function checkDeadlines() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const query = `
        SELECT t.id, t.Title, t.Date_end, te.executor
        FROM tasks t
        JOIN task_executors te ON t.id = te.task_id
        WHERE t.Date_ended IS NULL
        AND (
            (t.Date_end <= ? AND t.Date_end > ?)
            OR (t.Date_end <= ? AND t.Date_ended IS NULL)
        )
    `;
    querySelect(query, [tomorrow.toISOString(), now.toISOString(), now.toISOString()], (err, rows) => {
        if (err) {
            console.error('Ошибка при получении задач:', err.message);
            return;
        }
        rows.forEach((task) => {
            const queryUser = 'SELECT id FROM users WHERE CONCAT(Surname, " ", Name, " ", Patronymic) = ?';
            querySelect(queryUser, [task.executor], (err, userRows) => {
                if (err || userRows.length === 0) {
                    console.error(`Пользователь ${task.executor} не найден`);
                    return;
                }
                const userId = userRows[0].id;
                const deadline = new Date(task.Date_end);
                let message;
                if (deadline <= now) {
                    message = `Задача "${task.Title}" просрочена! Дедлайн был ${deadline.toLocaleDateString()}.`;
                } else {
                    message = `Напоминание: задача "${task.Title}" истекает ${deadline.toLocaleDateString()}.`;
                }
                sendNotification(userId, message);
            });
        });
    });
}

setInterval(checkDeadlines, 5 * 60 * 1000); 

export { bot };