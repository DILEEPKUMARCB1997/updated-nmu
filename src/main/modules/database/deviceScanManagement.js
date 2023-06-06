import { ipcMain } from 'electron';
import { apiCore } from '..';
import {
  REQUEST_MP_GET_MIP_LIST,
  RESPONSE_RP_GET_MIP_LIST,
  REQUEST_MP_SET_MIP_LIST,
  RESPONSE_RP_SET_MIP_LIST,
  REQUEST_MP_DELETE_MIP_LIST,
  RESPONSE_RP_DELETE_MIP_LIST,
} from '../../utils/IPCEvents';

ipcMain.on(REQUEST_MP_GET_MIP_LIST, (event, arg) => {
  const eventName = RESPONSE_RP_GET_MIP_LIST;
  try {
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    const result = apiCore.db.getIPListByMAC(
      { MACAddress: arg.MACAddress },
      true,
    );
    if (result == null) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Invalid Details',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'successfully get IPList',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get IPList',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_MIP_LIST, (event, arg) => {
  const eventName = RESPONSE_RP_SET_MIP_LIST;
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
    if (arg.IPAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found IPAddress',
      });
      return;
    }

    const result = apiCore.db.saveIPListByMAC(
      {
        MACAddress: arg.MACAddress,
        IPAddress: arg.IPAddress,
      },
      true,
    );
    if (result == null) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Invalid details',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'saved IPList successful',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - save IPList details',
    });
  }
});

ipcMain.on(REQUEST_MP_DELETE_MIP_LIST, (event, arg) => {
  const eventName = RESPONSE_RP_DELETE_MIP_LIST;
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

    const result = apiCore.db.deleteIPListByMAC(
      {
        MACAddress: arg.MACAddress,
      },
      true,
    );
    if (result == false) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Delete failed',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'Delete successful',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - delete IPList details',
    });
  }
});
