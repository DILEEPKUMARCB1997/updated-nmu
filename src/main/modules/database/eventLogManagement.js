import { ipcMain } from 'electron';
import { apiCore, windowManagement } from '..';
import {
  REQUEST_MP_GET_EVENT_LOG_HISTORY,
  RESPONSE_RP_GET_EVENT_LOG_HISTORY,
  SEND_RP_EVENT_LOG_UPDATE,
} from '../../utils/IPCEvents';
import telegramManagement from './telegramManagement';

function updateEventLog(data, type = 'event') {
  try {
    let result;
    switch (type) {
      case 'event':
        result = apiCore.db.updateEvent(data, true);
        break;
      case 'trap':
        result = apiCore.db.updateTrap(data, true);
        break;
      case 'syslog':
        result = apiCore.db.updateSyslog(data, true);
        break;
      case 'custom':
        result = apiCore.db.UpdateCustomEventLog(data, true);
        break;
      default:
        break;
    }

    if (result && !(result instanceof Error)) {
      windowManagement.default.send('mainId', SEND_RP_EVENT_LOG_UPDATE, {
        type,
        data: result,
      });

      if (type === 'custom') {
        telegramManagement.sendMessageTelegram(result);
      }
      // send notification
    }
  } catch (error) {
    console.error(error);
    return {
      success: false,
      msg: `Error in - save ${data.type} event log error`,
    };
  }
}

function getEventLogByMACAddress(data) {
  try {
    const result = apiCore.db.getLastEventLogByMACAddress(data, true);

    if (result != null) {
      return {
        success: true,
        msg: `Get ${data.type} event log successful`,
        data: result,
      };
    }
    return {
      success: false,
      msg: `Error in - get ${data.type} event log fail`,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      msg: `Error in - get ${data.type} event log error`,
    };
  }
}

export default { updateEventLog, getEventLogByMACAddress };

ipcMain.on(REQUEST_MP_GET_EVENT_LOG_HISTORY, (event, arg) => {
  //console.log('event');
  try {
    const filter = { ...arg };
    // const filter = {
    //   MACAddress: '00:60:E9:12:0A:00',
    // };
    //console.log(filter);
    const result = apiCore.db.getEventData(filter, true);
    if (result && !(result instanceof Error)) {
      event.sender.send(RESPONSE_RP_GET_EVENT_LOG_HISTORY, {
        success: true,
        type: arg.type,
        data: result,
      });
    }
    // console.log('result', result);
  } catch (error) {
    console.log(error);
  }
});
