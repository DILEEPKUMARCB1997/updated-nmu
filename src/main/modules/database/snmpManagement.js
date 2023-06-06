import { ipcMain } from 'electron';
import { apiCore, snmp } from '..';
import {
  REQUEST_MP_GET_SNMP_SETTINGS,
  RESPONSE_RP_GET_SNMP_SETTINGS,
  REQUEST_MP_SET_SNMP_SETTINGS,
  RESPONSE_RP_SET_SNMP_SETTINGS,
} from '../../utils/IPCEvents';

function getSNMPInitialData() {
  return apiCore.db.getSNMPInitialData({}, true);
}

function getSnmpSettings() {
  try {
    const result = apiCore.db.getSnmpSettings({}, true);

    if (result === null) {
      return { success: false, msg: 'Error in - get SNMP settings fail' };
    }
    return { success: true, msg: 'Get SNMP settings successful', data: result };
  } catch (error) {
    return { success: false, msg: 'Error in - get SNMP settings error' };
  }
}

function getIsFixedIp() {
  try {
    const result = apiCore.db.getIsFixedIp({}, true);

    if (result === null) {
      return { success: false, msg: 'Error in - get is fixed ip fail' };
    }
    return { success: true, msg: 'Get is fixed ip successful', data: result };
  } catch (error) {
    return { success: false, msg: 'Error in - get is fixed ip error' };
  }
}

function getAllDeviceScan() {
  try {
    const result = apiCore.db.getAllDeviceScan({}, true);

    if (result === null) {
      return { success: false, msg: 'Error in - get device scan fail' };
    }
    return { success: true, msg: 'Get device scan successful', data: result };
  } catch (error) {
    return { success: false, msg: 'Error in - get device scan error' };
  }
}

function getDeviceScanByMAC(MacAddress) {
  try {
    const result = apiCore.db.getDeviceScanByMAC(
      { MACAddress: MacAddress },
      true,
    );

    if (result === null) {
      return { success: false, msg: 'Error in - get device scan fail' };
    }
    return { success: true, msg: 'Get device scan successful', data: result };
  } catch (error) {
    return { success: false, msg: 'Error in - get device scan error' };
  }
}

export default {
  getSnmpSettings,
  getSNMPInitialData,
  getIsFixedIp,
  getAllDeviceScan,
  getDeviceScanByMAC,
};

ipcMain.on(REQUEST_MP_GET_SNMP_SETTINGS, event => {
  const eventName = RESPONSE_RP_GET_SNMP_SETTINGS;
  try {
    const snmpSettings = getSnmpSettings();
    if (snmpSettings.success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get SNMP settings successful',
        data: snmpSettings.data,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get SNMP settings fail',
      });
    }
  } catch (error) {
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get SNMP settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_SNMP_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_SNMP_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.isEnable === undefined || typeof arg.isEnable !== 'boolean') {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found isEnable',
      });
      return;
    }
    if (arg.isIpFixed === undefined || typeof arg.isIpFixed !== 'boolean') {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found isIpFixed',
      });
      return;
    }
    if (
      arg.SNMPPollInterval === undefined ||
      Number.isNaN(arg.SNMPPollInterval)
    ) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found SNMPPollInterval',
      });
      return;
    }
    if (arg.SNMPPollInterval < 1) {
      event.sender.send(eventName, {
        success: false,
        msg: 'SNMPPollInterval less than 1min',
      });
      return;
    }
    if (arg.ICMPTimeout === undefined || Number.isNaN(arg.ICMPTimeout)) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found ICMPTimeout',
      });
      return;
    }
    if (arg.ICMPTimeout < 2000) {
      event.sender.send(eventName, {
        success: false,
        msg: 'ICMPTimeout less than 2000ms',
      });
      return;
    }
    if (arg.SNMPTimeout === undefined || Number.isNaN(arg.SNMPTimeout)) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found SNMPTimeout',
      });
      return;
    }
    if (arg.SNMPTimeout < 3000) {
      event.sender.send(eventName, {
        success: false,
        msg: 'SNMPTimeout less than 3000ms',
      });
      return;
    }
    if (
      arg.version === undefined ||
      (arg.version !== 'v2c' && arg.version !== 'v1')
    ) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found version',
      });
      return;
    }
    if (arg.readCommunity === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found readCommunity',
      });
      return;
    }
    if (arg.writeCommunity === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found writeCommunity',
      });
      return;
    }

    const snmpOldSettings = getSnmpSettings();
    if (!snmpOldSettings.success) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get old snmpSettings',
      });
      return;
    }
    const snmpSetting = {
      isEnable: arg.isEnable,
      isIpFixed: arg.isIpFixed,
      SNMPPollInterval: arg.SNMPPollInterval,
      ICMPTimeout: arg.ICMPTimeout,
      SNMPTimeout: arg.SNMPTimeout,
      version: arg.version,
      readCommunity: arg.readCommunity,
      writeCommunity: arg.writeCommunity,
      isPrecheck: arg.isPrecheck,
    };

    const success = apiCore.db.setSnmpSettings(snmpSetting, true);
    if (success === true) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Set SNMP settings successful',
      });
      if (
        snmpOldSettings.data.SNMPPollInterval !== arg.SNMPPollInterval ||
        arg.isEnable
      ) {
        snmp.default.pollingReset();
      }
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set SNMP settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set SNMP settings error',
    });
  }
});
