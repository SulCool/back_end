import TelegramBot from 'node-telegram-bot-api';
import { queryRun, querySelect, getUserByLogin, getTasksByExecutor } from './database/bd.js';


const chatStates = new Map();

const token = ''; 
const bot = new TelegramBot(token, { polling: true });

const showMenu = (chatId) => {
    const options = {
        reply_markup: {
            keyboard: [
                [{ text: '/start' }, { text: '/tasks' }],
                [{ text: '/unlink' }]
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    bot.sendMessage(chatId, 'Выбери команду:', options);
};

const requestLogin = (chatId) => {
    chatStates.set(chatId, 'waiting_for_login');
    const options = {
        reply_markup: {
            keyboard: [[{ text: 'Отмена' }]],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
    bot.sendMessage(chatId, 'Отправьте теперь мне свой логин:', options);
};


bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const queryUser = 'SELECT user_id FROM telegram_users WHERE chat_id = ?';
    querySelect(queryUser, [chatId], (err, userRows) => {
        if (err) {
            bot.sendMessage(chatId, 'Произошла ошибка. Попробуй позже.');
            showMenu(chatId);
            return;
        }
        if (userRows.length > 0) {
            bot.sendMessage(chatId, 'Ты уже привязан к пользователю. Используй /unlink для отвязки или /tasks для просмотра задач.');
            showMenu(chatId);
            return;
        }
        requestLogin(chatId); 
    });
});


bot.onText(/\/start (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const login = match[1].trim();

    getUserByLogin(login, (err, rows) => {
        if (err || rows.length === 0) {
            bot.sendMessage(chatId, 'Пользователь с таким логином не найден.');
            showMenu(chatId);
            return;
        }

        const user = rows[0];
        const query = 'INSERT OR REPLACE INTO telegram_users (user_id, chat_id) VALUES (?, ?)';
        queryRun(query, [user.id, chatId], (err) => {
            if (err) {
                console.error('Ошибка при сохранении chatId:', err.message);
                bot.sendMessage(chatId, 'Ошибка сервера. Попробуй позже.');
                showMenu(chatId);
                return;
            }
            bot.sendMessage(chatId, `Ты зарегистрирован, ${user.Surname} ${user.Name}! Теперь я буду уведомлять тебя о задачах.`);
            showMenu(chatId);
        });
    });
});

bot.onText(/\/tasks/, (msg) => {
    const chatId = msg.chat.id;

    const queryUser = 'SELECT user_id FROM telegram_users WHERE chat_id = ?';
    querySelect(queryUser, [chatId], (err, userRows) => {
        if (err || userRows.length === 0) {
            bot.sendMessage(chatId, 'Ты не привязан к пользователю. Используй /start для привязки.');
            showMenu(chatId);
            return;
        }

        const userId = userRows[0].user_id;
        const queryUserName = 'SELECT CONCAT(Surname, " ", Name, " ", Patronymic) as full_name FROM users WHERE id = ?';
        querySelect(queryUserName, [userId], (err, nameRows) => {
            if (err || nameRows.length === 0) {
                bot.sendMessage(chatId, 'Ошибка при получении имени пользователя.');
                showMenu(chatId);
                return;
            }

            const executorName = nameRows[0].full_name;
            getTasksByExecutor(executorName, (err, tasks) => {
                if (err) {
                    bot.sendMessage(chatId, 'Ошибка при получении задач.');
                    showMenu(chatId);
                    return;
                }

                if (!tasks || tasks.length === 0) {
                    bot.sendMessage(chatId, 'У тебя нет активных задач.');
                    showMenu(chatId);
                    return;
                }

                let message = 'Твои активные задачи:\n';
                tasks.forEach((task, index) => {
                    const deadline = new Date(task.Date_end).toLocaleDateString();
                    const status = task.Date_ended ? 'Завершено' : (new Date(task.Date_end) < new Date() ? 'Просрочено' : 'В процессе');
                    message += `${index + 1}. ${task.Title} (Дедлайн: ${deadline}, Статус: ${status})\n`;
                });
                bot.sendMessage(chatId, message);
                showMenu(chatId);
            });
        });
    });
});

bot.onText(/\/unlink/, (msg) => {
    const chatId = msg.chat.id;

    const query = 'DELETE FROM telegram_users WHERE chat_id = ?';
    queryRun(query, [chatId], (err) => {
        if (err) {
            console.error('Ошибка при отвязке:', err.message);
            bot.sendMessage(chatId, 'Ошибка сервера. Попробуй позже.');
            showMenu(chatId);
            return;
        }
        bot.sendMessage(chatId, 'Ты успешно отвязан от пользователя. Используй /start для новой привязки.');
        showMenu(chatId);
    });
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (chatStates.get(chatId) === 'waiting_for_login') {
        if (text === 'Отмена') {
            chatStates.delete(chatId);
            bot.sendMessage(chatId, 'Действие отменено.');
            showMenu(chatId);
            return;
        }

        getUserByLogin(text, (err, rows) => {
            if (err || rows.length === 0) {
                bot.sendMessage(chatId, 'Пользователь с таким логином не найден. Попробуй снова или нажми "Отмена".');
                return;
            }

            const user = rows[0];
            const query = 'INSERT OR REPLACE INTO telegram_users (user_id, chat_id) VALUES (?, ?)';
            queryRun(query, [user.id, chatId], (err) => {
                if (err) {
                    console.error('Ошибка при сохранении chatId:', err.message);
                    bot.sendMessage(chatId, 'Ошибка сервера. Попробуй позже.');
                    showMenu(chatId);
                    return;
                }
                chatStates.delete(chatId);
                bot.sendMessage(chatId, `Ты зарегистрирован, ${user.Surname} ${user.Name}! Теперь я буду уведомлять тебя о задачах.`);
                showMenu(chatId);
            });
        });
    }
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