import { ipcMain } from 'electron';
import { apiCore } from '..';
import {
  REQUEST_MP_GET_IP_RANGE_SETTINGS,
  RESPONSE_RP_GET_IP_RANGE_SETTINGS,
  REQUEST_MP_SET_IP_RANGE_SETTINGS,
  RESPONSE_RP_SET_IP_RANGE_SETTINGS,
} from '../../utils/IPCEvents';

function getIPRangeSettings() {
  try {
    return { success: true, msg: 'Get IP range settings successful', data: JSON.parse(apiCore.db.getIPRange({}, true)) };
  } catch (error) {
    return { success: false, msg: 'Error in - get IP range settings error' };
  }
}

export default { getIPRangeSettings };

ipcMain.on(REQUEST_MP_GET_IP_RANGE_SETTINGS, (event) => {
  const eventName = RESPONSE_RP_GET_IP_RANGE_SETTINGS;
  try {
    const ipRangeSettings = getIPRangeSettings();
    if (ipRangeSettings.success) {
      const ipRangeList = [];
      Object.keys(ipRangeSettings.data).forEach((id) => {
        ipRangeList.push({
          id,
          startIP: ipRangeSettings.data[id].startIP,
          endIP: ipRangeSettings.data[id].endIP,
          isActive: ipRangeSettings.data[id].isActive,
        });
      });
      event.sender.send(eventName, { success: true, msg: 'Get IP range settings successful', data: ipRangeList });
    } else {
      event.sender.send(eventName, { success: false, msg: 'Error in - get IP range settings fail' });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, { success: false, msg: 'Error in - get IP range settings error' });
  }
});

ipcMain.on(REQUEST_MP_SET_IP_RANGE_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_IP_RANGE_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.ipRangeList === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found ipRangeList' });
      return;
    }

    const ipRangeUpdateList = {
      addIPRangeList: [],
      updateIPRangeList: {},
      deleteIPRangeList: [],
    };
    const ipRangeSettings = getIPRangeSettings().data;

    arg.ipRangeList.forEach((settings) => {
      if (settings.id !== undefined) {
        if (ipRangeSettings[settings.id] !== undefined) {
          if (settings.startIP !== ipRangeSettings[settings.id].startIP
            || settings.endIP !== ipRangeSettings[settings.id].endIP
            || settings.isActive !== ipRangeSettings[settings.id].isActive) {
            ipRangeUpdateList.updateIPRangeList[settings.id] = {
              startIP: settings.startIP,
              endIP: settings.endIP,
              isActive: settings.isActive,
            };
          }
          delete ipRangeSettings[settings.id];
        }
      } else {
        ipRangeUpdateList.addIPRangeList.push(settings);
      }
    });

    // delete IP range
    Object.keys(ipRangeSettings).forEach((id) => {
      ipRangeUpdateList.deleteIPRangeList.push(id);
    });

    const success = apiCore.db.setIPRange(ipRangeUpdateList, true);
    if (success) {
      event.sender.send(eventName, { success: true, msg: 'Set IP range settings successful' });
    } else {
      event.sender.send(eventName, { success: false, msg: 'Error in - set IP range settings fail' });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, { success: false, msg: 'Error in - set IP range settings error' });
  }
});

