import { ipcMain } from 'electron';
import { apiCore, snmp, snmpManagement } from '..';
import {
  REQUEST_MP_GET_DEVICE_COMMUNITY_SETTINGS,
  RESPONSE_RP_GET_DEVICE_COMMUNITY_SETTINGS,
  REQUEST_MP_SET_DEVICE_COMMUNITY_SETTINGS,
  RESPONSE_RP_SET_DEVICE_COMMUNITY_SETTINGS,
} from '../../utils/IPCEvents';

function getDeviceCommunity(IPAddress) {
  try {
    const result = apiCore.db.getDeviceCommunity({ IPAddress }, true);

    if (result === null) {
      return { success: false, msg: 'Error in - get device community fail' };
    }
    return {
      success: true,
      msg: 'Get device community successful',
      data: result,
    };
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - get device community error' };
  }
}

export default { getDeviceCommunity };

ipcMain.on(REQUEST_MP_GET_DEVICE_COMMUNITY_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_GET_DEVICE_COMMUNITY_SETTINGS;
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

    const result = apiCore.db.getDeviceCommSettings(
      { MACAddress: arg.MACAddress },
      true,
    );

    if (result === null) {
      const snmpSettings = snmpManagement.default.getSnmpSettings();
      if (!snmpSettings.success) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - get snmp default settings fail',
        });
        return;
      }

      const tmpSettings = {
        snmpVer: snmpSettings.data.version,
        readCommunity: snmpSettings.data.readCommunity,
        writeCommunity: snmpSettings.data.writeCommunity,
      };

      event.sender.send(eventName, {
        success: true,
        msg: 'Not found device community settings, this is default value',
        data: tmpSettings,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get device community settings successful',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get device community settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_DEVICE_COMMUNITY_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_DEVICE_COMMUNITY_SETTINGS;
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
    if (arg.snmpVer === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found snmpVer',
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

    const communitySetting = {
      MACAddress: arg.MACAddress,
      snmpVer: arg.snmpVer,
      readCommunity: arg.readCommunity,
      writeCommunity: arg.writeCommunity,
    };

    const success = apiCore.db.setDeviceCommSettings(communitySetting, true);
    if (success === true) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Set device community settings successful',
      });
      // update online snmp device community
      snmp.default.updateSessionCommunity(
        arg.MACAddress,
        arg.snmpVer,
        arg.readCommunity,
        arg.writeCommunity,
      );
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set device community settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set device community settings error',
    });
  }
});
