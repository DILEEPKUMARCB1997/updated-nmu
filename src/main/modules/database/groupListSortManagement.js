import { ipcMain } from 'electron';
import { apiCore } from '..';
import {
  REQUEST_MP_GET_SORT_GROUP_LIST,
  RESPONSE_RP_GET_SORT_GROUP_LIST,
  REQUEST_MP_SET_SORT_GROUP_LIST,
  RESPONSE_RP_SET_SORT_GROUP_LIST,
} from '../../utils/IPCEvents';

function getGroupSortListSettings() {
  try {
    return {
      success: true,
      msg: 'Get Group Sort List settings successful',
      data: apiCore.db.GetGroupSortList({}, true),
    };
  } catch (error) {
    return {
      success: false,
      msg: 'Error in - get group sort list settings error',
    };
  }
}

ipcMain.on(REQUEST_MP_GET_SORT_GROUP_LIST, event => {
  const eventName = RESPONSE_RP_GET_SORT_GROUP_LIST;
  try {
    const groupListSettings = getGroupSortListSettings();

    if (groupListSettings.success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get telegram settings successful',
        data: groupListSettings.data,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get telegram settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get telegram settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_SORT_GROUP_LIST, (event, arg) => {
  const eventName = RESPONSE_RP_SET_SORT_GROUP_LIST;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.groupList === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found sorted group list',
      });
      return;
    }

    const groupListSettings = {
      groupList: arg.groupList,
    };

    const success = apiCore.db.saveGroupSortList(groupListSettings, true);
    if (success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Set sort group list settings successful',
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set sort group list settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set sort group list settings error',
    });
  }
});
