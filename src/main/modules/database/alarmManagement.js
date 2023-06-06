// Definitions by: AlexLin

import { ipcMain } from 'electron';
import { apiCore, anyFault } from '..';
import {
  REQUEST_MP_SET_DEVICE_ALARM_SETTINGS,
  RESPONSE_RP_SET_DEVICE_ALARM_SETTINGS,
} from '../../utils/IPCEvents';

function getDeviceAlarm(MACAddress) {
  try {
    const result = apiCore.db.getDeviceAlarmSettings({ MACAddress }, true);

    if (result === null) {
      return { success: false, msg: 'Error in - get device alarm fail' };
    }
    return { success: true, msg: 'Get device alarm successful', data: result };
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - get device alarm error' };
  }
}

export default { getDeviceAlarm };

ipcMain.on(REQUEST_MP_SET_DEVICE_ALARM_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_DEVICE_ALARM_SETTINGS;
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
    if (arg.portInfo === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found portInfo',
      });
      return;
    }
    if (arg.powerInfo === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found powerInfo',
      });
      return;
    }

    const { MACAddress, portInfo, powerInfo } = arg;
    let setData = {};
    let tempPortInfo = {};
    let tempPowerInfo = {};

    Object.entries(JSON.parse(portInfo)).forEach(([key, value]) => {
      tempPortInfo = {
        ...tempPortInfo,
        [key]: `${Number(value.linkUp)}${Number(value.linkDown)}`,
      };
    });

    Object.entries(JSON.parse(powerInfo)).forEach(([key, value]) => {
      tempPowerInfo = {
        ...tempPowerInfo,
        [key]: `${Number(value.on)}${Number(value.off)}`,
      };
    });

    setData = {
      MACAddress,
      portInfo: tempPortInfo,
      powerInfo: tempPowerInfo,
    };
    const result = apiCore.db.setDeviceAlarmSettings(setData, true);

    if (result) {
      anyFault.updateAlarmSettingCollection(setData);
      event.sender.send(eventName, {
        success: true,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set device alarm settings error',
    });
  }
});
