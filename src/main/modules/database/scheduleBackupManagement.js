import { ipcMain } from 'electron';
import { apiCore, udpServer, nodeCron } from '..';
import {
  REQUEST_MP_SET_THE_SCHEDULE_BACKUP_DATA,
  RESPONSE_RP_SET_THE_SCHEDULE_BACKUP_DATA,
  REQUEST_MP_GET_THE_SCHEDULE_BACKUP_DATA,
  RESPONSE_RP_GET_THE_SCHEDULE_BACKUP_DATA,
  REQUEST_MP_SET_THE_SCHEDULE_DEVICE_DATA,
  RESPONSE_RP_SET_THE_SCHEDULE_DEVICE_DATA,
  REQUEST_MP_DELETE_SCHEDULE,
  RESPONSE_RP_DELETE_SCHEDULE,
} from '../../utils/IPCEvents';

ipcMain.on(REQUEST_MP_SET_THE_SCHEDULE_BACKUP_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_SET_THE_SCHEDULE_BACKUP_DATA;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.scheduleName === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found schedule name',
      });
      return;
    }

    const result = apiCore.db.addScheduleBackup(
      {
        scheduleId: arg.scheduleId,
        scheduleName: arg.scheduleName,
        frequency: arg.frequency,
        scheduleDate: arg.scheduleDate,
        scheduleTime: arg.scheduleTime,
        weeekDay: arg.weeekDay,
        customFrequency: arg.customFrequency,
      },
      true,
    );
    if (result == null) {
      event.sender.send(eventName, {
        success: false,
        msg: 'You can add only one schedule.',
        data: result,
      });
    } else {
      //nodeCron.start();
      if (arg.scheduleId !== '0') {
        nodeCron.default.start();
      }
      event.sender.send(eventName, {
        success: true,
        msg: 'schedule backup successfully saved',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - schedule backup',
    });
  }
});

ipcMain.on(REQUEST_MP_GET_THE_SCHEDULE_BACKUP_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_GET_THE_SCHEDULE_BACKUP_DATA;
  try {
    const result = JSON.parse(apiCore.db.getScheduleData({}, true));
    if (result == null) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Invalid Details',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'schedule backup successfully saved',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - schedule backup',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_THE_SCHEDULE_DEVICE_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_SET_THE_SCHEDULE_DEVICE_DATA;
  try {
    const result = JSON.parse(
      apiCore.db.addScheduleDevice(
        { scheduleId: arg.scheduleId, MACAddressList: arg.MACAddressList },
        true,
      ),
    );
    if (result == null) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Invalid Details',
        data: result,
      });
    } else {
      nodeCron.default.start();
      event.sender.send(eventName, {
        success: true,
        msg: 'schedule backup successfully saved',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - schedule backup',
    });
  }
});
ipcMain.on(REQUEST_MP_DELETE_SCHEDULE, (event, arg) => {
  const eventName = RESPONSE_RP_DELETE_SCHEDULE;
  try {
    const result = apiCore.db.deleteSchedule(
      { scheduleId: arg.scheduleId },
      true,
    );

    if (result == null) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - schedule backup delete',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'schedule backup successfully deleted',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - schedule backup delete',
    });
  }
});
