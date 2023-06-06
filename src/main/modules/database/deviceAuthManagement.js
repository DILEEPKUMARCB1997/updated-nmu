import { ipcMain } from 'electron';
import { apiCore, advancedManagement } from '..';
import {
  REQUEST_MP_GET_DEVICE_AUTHENTICATION_SETTINGS,
  RESPONSE_RP_GET_DEVICE_AUTHENTICATION_SETTINGS,
  REQUEST_MP_SET_DEVICE_AUTHENTICATION_SETTINGS,
  RESPONSE_RP_SET_DEVICE_AUTHENTICATION_SETTINGS,
} from '../../utils/IPCEvents';

function getDeviceAuth(MACAddress) {
  try {
    const result = apiCore.db.getDeviceAuthSettings({ MACAddress }, true);

    if (result === null) {
      const defaultSettings = advancedManagement.default.getDeviceAdvancedSettings();
      if (!defaultSettings.success) {
        return {
          success: false,
          msg: 'Error in - get device authentication fail',
        };
      }
      const authData = {
        username: defaultSettings.data.defaultUsername,
        password: defaultSettings.data.defaultPassword,
      };

      return {
        success: true,
        msg: 'Not found device authentication, this is default value',
        data: authData,
      };
    }

    return {
      success: true,
      msg: 'Get device authentication successful',
      data: result,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      msg: 'Error in - get device authentication error',
    };
  }
}

export default { getDeviceAuth };

ipcMain.on(REQUEST_MP_GET_DEVICE_AUTHENTICATION_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_GET_DEVICE_AUTHENTICATION_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }

    const result = apiCore.db.getDeviceAuthSettings(
      { MACAddress: arg.MACAddress },
      true,
    );

    if (result === null) {
      const defaultSettings = advancedManagement.default.getDeviceAdvancedSettings();
      if (!defaultSettings.success) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - get device authentication fail',
        });
        return;
      }
      const authData = {
        username: defaultSettings.data.defaultUsername,
        password: defaultSettings.data.defaultPassword,
      };

      event.sender.send(eventName, {
        success: true,
        msg: 'Not found device authentication, this is default value',
        data: authData,
      });
      return;
    }

    event.sender.send(eventName, {
      success: true,
      msg: 'Get device authentication successful',
      data: result,
    });
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get device authentication settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_DEVICE_AUTHENTICATION_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_DEVICE_AUTHENTICATION_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found settings',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    if (arg.username === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found username',
      });
      return;
    }
    if (arg.password === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found password',
      });
      return;
    }

    const authSetting = {
      MACAddress: arg.MACAddress,
      username: arg.username,
      password: arg.password,
    };

    const success = apiCore.db.setDeviceAuthSettings(authSetting, true);
    if (success === true) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get device authentication settings successful',
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set device authentication settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set device authentication settings error',
    });
  }
});
