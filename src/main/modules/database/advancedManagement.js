import { ipcMain } from 'electron';
import { apiCore, offlineDetection } from '..';
import {
  REQUEST_MP_GET_ALL_ADVANCED_SETTINGS,
  RESPONSE_RP_GET_ALL_ADVANCED_SETTINGS,
  REQUEST_MP_GET_DEVICE_ADVANCED_SETTINGS,
  RESPONSE_RP_GET_DEVICE_ADVANCED_SETTINGS,
  REQUEST_MP_SET_ALL_ADVANCED_SETTINGS,
  RESPONSE_RP_SETALL_ADVANCED_SETTINGS,
} from '../../utils/IPCEvents';
// get all advanced settings
function getAllAdvancedSettings() {
  try {
    const result = apiCore.db.getAdvancedSettings({}, true);
    if (result === null) {
      return { success: false, msg: 'Error in - get advanced settings fail' };
    }
    return {
      success: true,
      msg: 'Get advanced settings successful',
      data: result,
    };
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - get advanced settings error' };
  }
}

// get all advanced settings
function getFwUpdateAdvancedSettings() {
  try {
    const allAdvancedSettings = getAllAdvancedSettings();

    if (!allAdvancedSettings.success) {
      return {
        success: false,
        msg: 'Error in - get fwUpdate advanced settings fail',
      };
    }

    const fwUpdateAdvancedSettings = {
      fwUpdateBatchQuantity: allAdvancedSettings.data.fwUpdateBatchQuantity,
      fwUpdateConnTimeout: allAdvancedSettings.data.fwUpdateConnTimeout,
    };
    return {
      success: true,
      msg: 'Get fwUpdate advanced settings successful',
      data: fwUpdateAdvancedSettings,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      msg: 'Error in - get fwUpdate advanced settings error',
    };
  }
}

// get all advanced settings
function getOfflineDetectionAdvancedSettings() {
  try {
    const allAdvancedSettings = getAllAdvancedSettings();

    if (!allAdvancedSettings.success) {
      return {
        success: false,
        msg: 'Error in - get offlinePollInterval advanced settings fail',
      };
    }

    const offlineDetectionAdvancedSettings = {
      offlinePollInterval: allAdvancedSettings.data.offlinePollInterval,
      offlineTimeout: allAdvancedSettings.data.offlineTimeout,
    };
    return {
      success: true,
      msg: 'Get device advanced settings successful',
      data: offlineDetectionAdvancedSettings,
    };
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - get advanced settings error' };
  }
}

// get device advanced settings
function getDeviceAdvancedSettings() {
  try {
    const allAdvancedSettings = getAllAdvancedSettings();
    if (!allAdvancedSettings.success) {
      return {
        success: false,
        msg: 'Error in - get device advanced settings fail',
      };
    }

    const deviceAdvancedSettings = {
      defaultUsername: allAdvancedSettings.data.defaultUsername,
      defaultPassword: allAdvancedSettings.data.defaultPassword,
    };

    return {
      success: true,
      msg: 'Get device advanced settings successful',
      data: deviceAdvancedSettings,
    };
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - get advanced settings error' };
  }
}

export default {
  getAllAdvancedSettings,
  getFwUpdateAdvancedSettings,
  getOfflineDetectionAdvancedSettings,
  getDeviceAdvancedSettings,
};

ipcMain.on(REQUEST_MP_GET_ALL_ADVANCED_SETTINGS, event => {
  const eventName = RESPONSE_RP_GET_ALL_ADVANCED_SETTINGS;
  try {
    const allAdvancedSettings = getAllAdvancedSettings();

    if (allAdvancedSettings.success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get all advanced settings successful',
        data: allAdvancedSettings.data,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get all advanced settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get all advanced settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_GET_DEVICE_ADVANCED_SETTINGS, event => {
  const eventName = RESPONSE_RP_GET_DEVICE_ADVANCED_SETTINGS;
  try {
    const deviceAdvancedSettings = getDeviceAdvancedSettings();

    if (deviceAdvancedSettings.success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get device advanced settings successful',
        data: deviceAdvancedSettings.data,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get device advanced settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get device advanced settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_ALL_ADVANCED_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_SETALL_ADVANCED_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.defaultUsername === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found defaultUsername',
      });
      return;
    }
    if (arg.defaultPassword === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found defaultPassword',
      });
      return;
    }
    if (
      arg.offlinePollInterval === undefined ||
      Number.isNaN(arg.offlinePollInterval)
    ) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found offlinePollInterval',
      });
      return;
    }
    if (arg.offlinePollInterval < 1) {
      event.sender.send(eventName, {
        success: false,
        msg: 'offlinePollInterval less than 1sec',
      });
      return;
    }
    if (arg.offlineTimeout === undefined || Number.isNaN(arg.offlineTimeout)) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found offlineTimeout',
      });
      return;
    }
    if (arg.offlineTimeout < 2000) {
      event.sender.send(eventName, {
        success: false,
        msg: 'offlineTimeout less than 2000ms',
      });
      return;
    }
    if (
      arg.fwUpdateBatchQuantity === undefined ||
      Number.isNaN(arg.fwUpdateBatchQuantity)
    ) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found fwUpdateBatchQuantity',
      });
      return;
    }
    if (arg.fwUpdateBatchQuantity < 1) {
      event.sender.send(eventName, {
        success: false,
        msg: 'fwUpdateBatchQuantity less than 1',
      });
      return;
    }
    if (
      arg.fwUpdateConnTimeout === undefined ||
      Number.isNaN(arg.fwUpdateConnTimeout)
    ) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found fwUpdateConnTimeout',
      });
      return;
    }
    if (arg.fwUpdateConnTimeout < 2000) {
      event.sender.send(eventName, {
        success: false,
        msg: 'fwUpdateConnTimeout less than 2000ms',
      });
      return;
    }

    const deviceAdvancedSettings = getAllAdvancedSettings();

    const advancedSetting = {
      defaultUsername: arg.defaultUsername,
      defaultPassword: arg.defaultPassword,
      offlinePollInterval: arg.offlinePollInterval,
      offlineTimeout: arg.offlineTimeout,
      fwUpdateBatchQuantity: arg.fwUpdateBatchQuantity,
      fwUpdateConnTimeout: arg.fwUpdateConnTimeout,
    };

    const success = apiCore.db.setAdvancedSettings(advancedSetting, true);

    if (success === true) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Set advanced settings successful',
      });
      if (
        deviceAdvancedSettings.data.offlinePollInterval !==
        arg.offlinePollInterval
      ) {
        offlineDetection.default.detectReset();
      }
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set advanced settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set advanced settings error',
    });
  }
});
