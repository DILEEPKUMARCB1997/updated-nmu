import { ipcMain } from 'electron';
import { apiCore, udpServer, userManagement } from '..';
import {
  RESPONSE_RP_GET_ALL_NETWORK_INTERFACES,
  REQUEST_MP_GET_ALL_NETWORK_INTERFACES,
  REQUEST_MP_SET_THE_NETWORK_INTERFACE,
  RESPONSE_RP_SET_THE_NETWORK_INTERFACE,
} from '../../utils/IPCEvents';

function getCurrentNetworkInterface() {
  try {
    const result = apiCore.db.getCurrentIFace({}, true);
    const result1 = apiCore.db.getLoginDetails(
      { username: 'admin', password: 'admin123' },
      true,
    );
    if (result == null) {
      return {
        success: false,
        msg: 'Error in - get all network interfaces error',
      };
    }
    return {
      success: true,
      msg: 'Get all network interfaces successful',
      data: result,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      msg: 'Error in - get all network interfaces error',
    };
  }
}
export default { getCurrentNetworkInterface };

ipcMain.on(REQUEST_MP_GET_ALL_NETWORK_INTERFACES, event => {
  const eventName = RESPONSE_RP_GET_ALL_NETWORK_INTERFACES;
  try {
    const networkInterfaces = JSON.parse(apiCore.db.getIFace({}, true));
    event.sender.send(eventName, {
      success: true,
      msg: 'Get all network interfaces successful',
      data: networkInterfaces,
    });
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get all network interfaces error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_THE_NETWORK_INTERFACE, (event, arg) => {
  const eventName = RESPONSE_RP_SET_THE_NETWORK_INTERFACE;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.name === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found name' });
      return;
    }
    if (arg.IPAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found IPAddress',
      });
      return;
    }

    const success = apiCore.db.setIFace(
      { name: arg.name, IPAddress: arg.IPAddress },
      true,
    );
    if (success) {
      udpServer.default.bind(arg.IPAddress, 55954);
      event.sender.send(eventName, {
        success: true,
        msg: 'Set the network interface successful',
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set the network interface fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set the network interface error',
    });
  }
});
