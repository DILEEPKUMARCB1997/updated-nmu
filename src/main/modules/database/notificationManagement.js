import { ipcMain } from 'electron';
import { apiCore, mailer } from '..';
import {
  REQUEST_MP_GET_NOTIFICATION_SETTINGS,
  RESPONSE_RP_GET_NOTIFICATION_SETTINGS,
  REQUEST_MP_SET_NOTIFICATION_SETTINGS,
  RESPONSE_RP_SET_NOTIFICATION_SETTINGS,
} from '../../utils/IPCEvents';

function getNotificationSettings() {
  try {
    return {
      success: true,
      msg: 'Get mail settings successful',
      data: apiCore.db.GetGlobalNotificationSettings({}, true),
    };
  } catch (error) {
    return { success: false, msg: 'Error in - get mail settings error' };
  }
}

ipcMain.on(REQUEST_MP_GET_NOTIFICATION_SETTINGS, event => {
  const eventName = RESPONSE_RP_GET_NOTIFICATION_SETTINGS;
  try {
    const notificationSetting = getNotificationSettings();
    if (notificationSetting.success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'get notification setting successful',
        data: notificationSetting.data,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get notification settings fail',
      });
    }
  } catch (error) {
    console.log(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get notification settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_NOTIFICATION_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_NOTIFICATION_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.type === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found type' });
      return;
    }
    if (arg.value === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found value',
      });
      return;
    }
    const success = apiCore.db.SaveGlobalNotification(arg, true);
    if (success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Set notification settings successful',
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set notification settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set notification settings error',
    });
  }
});
