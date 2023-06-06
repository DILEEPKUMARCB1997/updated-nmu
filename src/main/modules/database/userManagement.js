import { ipcMain } from 'electron';
import { apiCore, udpServer } from '..';
import {
  REQUEST_MP_GET_USER_DETAILS,
  RESPONSE_RP_GET_USER_DETAILS,
  REQUEST_MP_GET_USERS_DATA,
  RESPONSE_RP_GET_USERS_DATA,
  REQUEST_MP_SET_USER_DETAILS,
  RESPONSE_RP_SET_USER_DETAILS,
  REQUEST_MP_DELETE_USER_DETAILS,
  RESPONSE_RP_DELETE_USER_DETAILS,
} from '../../utils/IPCEvents';

function getLoginDetails(user) {
  try {
    const result = apiCore.db.getLoginDetails(
      { username: user.loginUsername, password: user.loginPassword },
      true,
    );
    if (result == null) {
      return { success: false, msg: 'Error in - get all User details' };
    }
    return {
      success: true,
      msg: 'Get all user details successful',
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

export default { getLoginDetails };

ipcMain.on(REQUEST_MP_GET_USERS_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_GET_USERS_DATA;
  try {
    const result = apiCore.db.getUsersData({}, true);
    if (result == null) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Invalid Details',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'successfully get users data',
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

ipcMain.on(REQUEST_MP_GET_USER_DETAILS, (event, arg) => {
  const eventName = RESPONSE_RP_GET_USER_DETAILS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.username === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found username',
      });
      return;
    }
    if (arg.password === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found password',
      });
      return;
    }

    const result = apiCore.db.getLoginDetails(
      { username: arg.username, password: arg.password },
      true,
    );
    if (result == null) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Invalid Credential',
        data: result,
      });
    } else {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get Login datails successful',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get login details',
    });
  }
});
// save and update
ipcMain.on(REQUEST_MP_SET_USER_DETAILS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_USER_DETAILS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.username === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found username',
      });
      return;
    }
    if (arg.password === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found password',
      });
      return;
    }
    if (arg.userType === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found role',
      });
      return;
    }

    if (arg.createdBy === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found created by',
      });
      return;
    }

    const result = apiCore.db.SaveUserData(
      {
        UserId: arg.UserId,
        username: arg.username,
        password: arg.password,
        userType: arg.userType,
        createdBy: arg.createdBy,
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
        msg: 'saved user datails successful',
        data: result,
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - save user details',
    });
  }
});
// delete and update
ipcMain.on(REQUEST_MP_DELETE_USER_DETAILS, (event, arg) => {
  const eventName = RESPONSE_RP_DELETE_USER_DETAILS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.UserId === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found user id',
      });
      return;
    }

    const result = apiCore.db.DeleteUser(
      {
        UserId: arg.UserId,
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
      msg: 'Error in - save user details',
    });
  }
});
