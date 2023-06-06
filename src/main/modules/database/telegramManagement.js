import { ipcMain } from 'electron';
import { apiCore, telegram } from '..';
import {
  REQUEST_MP_GET_TELEGRAM_TOKEN,
  RESPONSE_RP_GET_TELEGRAM_TOKEN,
  REQUEST_MP_SET_TELEGRAM_TOKEN,
  RESPONSE_RP_SET_TELEGRAM_TOKEN,
  REQUEST_MP_GET_TELEGRAM_USER,
  RESPONSE_RP_GET_TELEGRAM_USER,
  REQUEST_MP_SET_TELEGRAM_USER,
  RESPONSE_RP_SET_TELEGRAM_USER,
  REQUEST_MP_DELETE_TELEGRAM_USER,
  RESPONSE_RP_DELETE_TELEGRAM_USER,
  REQUEST_SEND_TELEGRAM_MSG,
} from '../../utils/IPCEvents';

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

ipcMain.on(REQUEST_MP_GET_TELEGRAM_TOKEN, event => {
  const eventName = RESPONSE_RP_GET_TELEGRAM_TOKEN;
  try {
    const telegramSettings = getTokenSettings();

    if (telegramSettings.success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get telegram settings successful',
        data: telegramSettings.data,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get telegram settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get telegram settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_TELEGRAM_TOKEN, (event, arg) => {
  const eventName = RESPONSE_RP_SET_TELEGRAM_TOKEN;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.token === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found token' });
      return;
    }

    const tokenSettings = {
      token: arg.token,
    };

    const success = apiCore.db.saveTelegramToken(tokenSettings, true);
    if (success) {
      telegram.default.getInfo();
      event.sender.send(eventName, {
        success: true,
        msg: 'Set telegram token settings successful',
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set telegram token settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set telegram token settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_GET_TELEGRAM_USER, event => {
  const eventName = RESPONSE_RP_GET_TELEGRAM_USER;
  try {
    const telegramUser = apiCore.db.getAllTelegramUser({}, true);

    if (telegramUser !== null) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get telegram user settings successful',
        data: telegramUser,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get telegram user settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get telegram user settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_TELEGRAM_USER, (event, arg) => {
  const eventName = RESPONSE_RP_SET_TELEGRAM_USER;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.telegramId === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found telegram id',
      });
      return;
    }
    if (arg.telegramName === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found telegram name',
      });
      return;
    }
    if (arg.telegramType === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found telegram type',
      });
      return;
    }

    const userSettings = {
      telegramId: arg.telegramId,
      telegramName: arg.telegramName,
      telegramType: arg.telegramType,
    };

    const success = apiCore.db.saveTelegramUser(userSettings, true);
    if (success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Set telegram user settings successful',
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set telegram user settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set telegram user settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_DELETE_TELEGRAM_USER, (event, arg) => {
  const eventName = RESPONSE_RP_DELETE_TELEGRAM_USER;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.userId === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found telegram user id',
      });
      return;
    }

    const userSettings = {
      userId: arg.userId,
    };

    const success = apiCore.db.deleteTelegramUser(userSettings, true);
    if (success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Delete telegram user settings successful',
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - delete telegram user settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - delete telegram user settings error',
    });
  }
});

ipcMain.on(REQUEST_SEND_TELEGRAM_MSG, (event, arg) => {
  try {
    telegram.default.sendAll(arg);
  } catch (error) {
    console.error(error);
  }
});

function sendOfflineTelegram(data) {
  // console.log('telegram Server: Send offline Telegram.');
  try {
    const mailData = {};

    mailData.html = `<b>Warning</b>\nThere are something wrong with ${
      Object.keys(data).length
    } device(s), detail:\n\n`;

    Object.keys(data).forEach(MACAddress => {
      mailData.html += `model: ${data[MACAddress].model}, IP: ${data[MACAddress].IPAddress}, MAC Address: ${MACAddress}`;

      switch (data[MACAddress].deviceType) {
        case 'gwd':
          if (data[MACAddress].hasDisable.includes('gwd')) {
            mailData.html +=
              ', device basic unreachable, device is currently offline.';
          }
          break;
        case 'snmp':
          if (data[MACAddress].hasDisable.includes('snmp')) {
            mailData.html +=
              ', device SNMP unreachable, device is currently offline.';
          }
          break;
        case 'all':
          if (data[MACAddress].hasDisable.includes('gwd')) {
            mailData.html += ', device basic unreachable';
          }

          if (data[MACAddress].hasDisable.includes('snmp')) {
            mailData.html += ', device SNMP unreachable';
          }

          if (
            data[MACAddress].hasDisable.includes('gwd') &&
            data[MACAddress].hasDisable.includes('snmp')
          ) {
            mailData.html += ', device is currently offline.';
          }
          break;
        default:
          mailData.html += ', device is currently offline.';
          break;
      }
      mailData.html += '\n\n';
    });
    telegram.default.sendAll(mailData.html);
    //mailer.default.sendMail(mailData);
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - send telegram error' };
  }
}

function sendMessageTelegram(data) {
  // console.log('telegram Server: Send offline Telegram.');
  try {
    const mailData = {};
    //console.log('trap msg', data);
    mailData.html = `<b>${data.severity}</b>\nThere are something wrong with ${data.sourceIP} device, detail:\n\n`;
    mailData.html += `model: ${data.model}, MACAddress: ${data.MACAddress},\n<b>message: ${data.msg}</b>`;
    mailData.html += '\n\n';
    telegram.default.sendAll(mailData.html);
    ////mailer.default.sendMail(mailData);
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - send telegram error' };
  }
}

export default { sendOfflineTelegram, getTokenSettings, sendMessageTelegram };
