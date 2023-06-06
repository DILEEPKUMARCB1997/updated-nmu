//const TelegramBot = require("node-telegram-bot-api");
import TelegramBot from 'node-telegram-bot-api';
import { apiCore, telegramManagement } from '..';

// const TOKEN = '1625286624:AAG4wPvQmzE-1V4j02WgZ9nJ_JzX9py9r3Y';

// const bot = new TelegramBot(TOKEN, { polling: true });

process.env.NTBA_FIX_319 = 1;

let bot = null;

function getUserSettings() {
  try {
    return {
      success: true,
      msg: 'Get mail settings successful',
      data: apiCore.db.getAllTelegramUser({}, true),
    };
  } catch (error) {
    return { success: false, msg: 'Error in - get mail settings error' };
  }
}

function sendAll(msg) {
  const telegramUsers = getUserSettings();
  let chatIDs = new Set([...telegramUsers.data]);
  if (bot !== null) {
    chatIDs.forEach(item => {
      bot.sendMessage(Number(item.telegramId), msg, { parse_mode: 'HTML' });
    });
  }
}

function getTokenSettings() {
  try {
    return {
      success: true,
      msg: 'Get mail settings successful',
      data: apiCore.db.GetTelegramToken({}, true),
    };
  } catch (error) {
    return { success: false, msg: 'Error in - get mail settings error' };
  }
}
function getInfo() {
  const telegramSettings = getTokenSettings();
  //console.log(telegramSettings);
  const TOKEN = telegramSettings.data.token;

  bot = new TelegramBot(TOKEN, { polling: true });
  bot.on('polling_error', error => {});
  bot.onText(/\/getId/, async (msg, match) => {
    await bot.sendMessage(msg.chat.id, JSON.stringify(msg.chat, null, 2));
  });
}

export default { getInfo, sendAll };
