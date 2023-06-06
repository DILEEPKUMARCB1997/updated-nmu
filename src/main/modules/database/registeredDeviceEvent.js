import { ipcMain } from 'electron';
import { apiCore } from '..';
import {
  REQUEST_MP_GET_REGISTER_EVENT_DATA,
  RESPONSE_RP_GET_REGISTER_EVENT_DATA,
  REQUEST_MP_ENABLE_REGISTER_EVENT_DATA,
  RESPONSE_RP_ENABLE_REGISTER_EVENT_DATA,
  REQUEST_MP_SET_REGISTER_EVENT_DATA,
  RESPONSE_RP_SET_REGISTER_EVENT_DATA,
  REQUEST_MP_DELETE_REGISTER_EVENT_DATA,
  RESPONSE_RP_DELETE_REGISTER_EVENT_DATA,
  REQUEST_MP_UPDATE_REGISTER_EVENT_NOTIFICATION,
  RESPONSE_RP_UPDATE_REGISTER_EVENT_NOTIFICATION,
  REQUEST_MP_UPDATE_REGISTER_NOTIFICATION_TYPE,
  RESPONSE_RP_UPDATE_REGISTER_NOTIFICATION_TYPE,
} from '../../utils/IPCEvents';

ipcMain.on(REQUEST_MP_GET_REGISTER_EVENT_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_GET_REGISTER_EVENT_DATA;
  try {
    const result = apiCore.db.getAllRegisteredEventData(
      { type: arg.type },
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
        msg: 'successfully get register event data',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - register event',
    });
  }
});

// enable/disable register event data
ipcMain.on(REQUEST_MP_ENABLE_REGISTER_EVENT_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_ENABLE_REGISTER_EVENT_DATA;
  try {
    const result = apiCore.db.enableRegisteredEventData(
      { type: arg.type, value: arg.value },
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
        msg: 'successfully enable/disable register event data',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - register event',
    });
  }
});

// save and update
ipcMain.on(REQUEST_MP_SET_REGISTER_EVENT_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_SET_REGISTER_EVENT_DATA;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.eventName === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found event name',
      });
      return;
    }
    if (arg.severity === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found severity',
      });
      return;
    }
    if (arg.registeredDevice === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found device IPAddress',
      });
      return;
    }

    if (arg.eventCondition === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found event condition',
      });
      return;
    }

    const result = apiCore.db.insertRegisterEvent(
      {
        id: arg.id,
        eventName: arg.eventName,
        severity: arg.severity,
        registeredDevice: arg.registeredDevice,
        eventCondition: arg.eventCondition,
        port: arg.port,
        traffic: arg.traffic,
        condition: arg.condition,
        percent: arg.percent,
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
        msg: 'saved register event datails successful',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - save register event details',
    });
  }
});

// delete and update
ipcMain.on(REQUEST_MP_DELETE_REGISTER_EVENT_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_DELETE_REGISTER_EVENT_DATA;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    const result = apiCore.db.DeleteRegisterEvent(arg, true);
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
      msg: 'Error in - delete event',
    });
  }
});

//  update
ipcMain.on(REQUEST_MP_UPDATE_REGISTER_EVENT_NOTIFICATION, (event, arg) => {
  const eventName = RESPONSE_RP_UPDATE_REGISTER_EVENT_NOTIFICATION;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    const result = apiCore.db.UpdateRegisteredEventNotification(arg, true);
    if (result == false) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Notification update failed',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'Notification update successful',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - Notification update event',
    });
  }
});

//  update
ipcMain.on(REQUEST_MP_UPDATE_REGISTER_NOTIFICATION_TYPE, (event, arg) => {
  const eventName = RESPONSE_RP_UPDATE_REGISTER_NOTIFICATION_TYPE;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    const result = apiCore.db.UpdateRegisteredNotificationType(arg, true);
    if (result == false) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Notification update failed',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'Notification update successful',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - Notification update event',
    });
  }
});
