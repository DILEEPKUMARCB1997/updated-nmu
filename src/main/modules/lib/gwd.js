import { ipcMain } from 'electron';
import async from 'async';
import {
  apiCore,
  udpServer,
  deviceIntegration,
  offlineDetection,
  queueManagement,
  deviceAuthManagement,
} from '..';
import {
  REQUEST_MP_REBOOT_GWD_DEVICE,
  RESPONSE_RP_REBOOT_GWD_DEVICE,
  REQUEST_MP_LET_GWD_DEVICE_BEEP,
  RESPONSE_RP_LET_GWD_DEVICE_BEEP,
  REQUEST_MP_SET_GWD_DEVICE_NETWORK_SETTINGS,
  RESPONSE_RP_SET_GWD_DEVICE_NETWORK_SETTINGS,
} from '../../utils/IPCEvents';

const gwdAckWaitingList = {};
let duplicateLockList = {};
let lockInit = true;

// initialization the list,and kill all work queue.
function initialize() {
  try {
    lockInit = false;
    duplicateLockList = {};
    // kill all queue.
    onlinePacketQueue.kill();
    receiverQueue.kill();

    // send boradcast to invite
    deviceDiscovery();
  } catch (error) {
    console.error(error);
  }
}

// broadcast received new device  new device online
function broadcastReceiver(packet) {
  try {
    if (lockInit) {
      return;
    }
    // parser MAC address from packet
    //console.log(packet.slice(28, 34).toString('hex'));
    const MACAddress = packet
      .slice(28, 34)
      .toString('hex')
      .match(/.{1,2}/g)
      .join(':')
      .toUpperCase();

    // handle offline detection
    offlineDetection.default.gwdDeviceOnlineMessage({
      MACAddress,
      online: true,
    });
    deviceIntegration.default.gwdDeviceOnlineMessage({
      MACAddress,
      online: true,
    });

    // add packet to receiver queue
    queueManagement.default.add(receiverQueue, packet);
  } catch (error) {
    console.error(error);
  }
}

// send broadcast to discovery ;export for offline detection
function deviceDiscovery() {
  try {
    const message = apiCore.method.getInvitePacket({}, true);
    udpServer.default.send(message, '255.255.255.255', 55954);
    setTimeout(() => {
      udpServer.default.send(message, '255.255.255.255', 55954);
    }, 400);
    setTimeout(() => {
      udpServer.default.send(message, '255.255.255.255', 55954);
    }, 800);
  } catch (error) {
    console.error(error);
  }
}

export default {
  initialize,
  broadcastReceiver,
  deviceDiscovery,
};

// receiver queue
const receiverQueue = async.queue((packet, callback) => {
  try {
    if (lockInit) {
      callback();
      return;
    }
    // parser MAC address from packet
    const MACAddress = packet
      .slice(28, 34)
      .toString('hex')
      .match(/.{1,2}/g)
      .join(':')
      .toUpperCase();

    // handle gwd config ack
    if (gwdAckWaitingList[MACAddress] !== undefined) {
      clearTimeout(gwdAckWaitingList[MACAddress].timeout);
      gwdAckWaitingList[MACAddress].event.sender.send(
        gwdAckWaitingList[MACAddress].eventName,
        { success: true, msg: 'set successful', data: { MACAddress } },
      );
      delete gwdAckWaitingList[MACAddress];
    }

    // lock duplicate modelinfo
    if (duplicateLockList[MACAddress] !== undefined) {
      callback();
      return;
    }

    duplicateLockList[MACAddress] = {
      timeout: setTimeout(() => {
        delete duplicateLockList[MACAddress];
      }, 500),
    };

    const modelInfo = apiCore.method.getModelInfo(packet, true);
    if (modelInfo == null) {
      callback();
      return;
    }

    let isGroup = false;
    let hasModelChange = false;
    let isNewModel = true;
    let isDeviceTypeAll = false;

    const deviceGroupList = deviceIntegration.default.getDeviceGroupList();
    Object.keys(deviceGroupList).every(groupId => {
      if (deviceGroupList[groupId].deviceList[MACAddress] !== undefined) {
        isNewModel = false;
        if (
          deviceGroupList[groupId].deviceList[MACAddress].deviceType === 'all'
        ) {
          isDeviceTypeAll = true;
        }
        if (!deviceGroupList[groupId].deviceList[MACAddress].online) {
          hasModelChange = true;
        } else {
          if (
            modelInfo.model !==
            deviceGroupList[groupId].deviceList[MACAddress].model
          ) {
            hasModelChange = true;
          }
          if (
            modelInfo.IPAddress !==
            deviceGroupList[groupId].deviceList[MACAddress].IPAddress
          ) {
            hasModelChange = true;
          }
          if (
            modelInfo.netmask !==
            deviceGroupList[groupId].deviceList[MACAddress].netmask
          ) {
            hasModelChange = true;
          }
          if (
            modelInfo.gateway !==
            deviceGroupList[groupId].deviceList[MACAddress].gateway
          ) {
            hasModelChange = true;
          }
          if (
            modelInfo.hostname !==
            deviceGroupList[groupId].deviceList[MACAddress].hostname
          ) {
            hasModelChange = true;
          }
          if (
            modelInfo.kernel !==
            deviceGroupList[groupId].deviceList[MACAddress].kernel
          ) {
            hasModelChange = true;
          }
          if (
            modelInfo.ap !== deviceGroupList[groupId].deviceList[MACAddress].ap
          ) {
            hasModelChange = true;
          }
        }
        if (groupId !== 'unGrouped') {
          isGroup = true;
        }
        return false;
      }
      return true;
    });

    if (!isDeviceTypeAll) {
      if (hasModelChange || isNewModel) {
        // change the priority,if isGroup
        if (isGroup) {
          queueManagement.default.add(onlinePacketQueue, {
            level: 0,
            isGroup,
            modelInfo,
          });
        } else {
          queueManagement.default.add(onlinePacketQueue, {
            isGroup,
            modelInfo,
          });
        }
      }
    }

    callback();
  } catch (error) {
    console.log(error);
    callback();
  }
}, 1);

// send online packet to deviceGroupList
const onlinePacketQueue = async.queue((tmp, callback) => {
  try {
    deviceIntegration.default.updateDeviceGroupList({
      cmd: 'onlineDevice',
      isGroup: tmp.isGroup,
      device: tmp.modelInfo,
      deviceType: 'gwd',
    });
    callback();
  } catch (error) {
    console.error(error);
    callback();
  }
}, 1);

ipcMain.on(REQUEST_MP_REBOOT_GWD_DEVICE, (event, arg) => {
  const eventName = RESPONSE_RP_REBOOT_GWD_DEVICE;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    if (arg.IPAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found IPAddress',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }

    const authSetting = deviceAuthManagement.default.getDeviceAuth(
      arg.MACAddress,
    );
    if (!authSetting.success) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get device authentication fail',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    const tmpData = {};
    tmpData.MACAddress = arg.MACAddress;
    tmpData.IPAddress = arg.IPAddress;
    tmpData.username = authSetting.data.username;
    tmpData.password = authSetting.data.password;

    gwdAckWaitingList[arg.MACAddress] = {
      event,
      eventName,
      timeout: setTimeout(() => {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - reboot timeout',
          data: { MACAddress: arg.MACAddress },
        });
        delete gwdAckWaitingList[arg.MACAddress];
      }, 2000),
    };

    const message = apiCore.method.getRebootPacket(tmpData, true);
    udpServer.default.send(message, '255.255.255.255', 55954);
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - gwd device reboot error',
    });
  }
});

ipcMain.on(REQUEST_MP_LET_GWD_DEVICE_BEEP, (event, arg) => {
  const eventName = RESPONSE_RP_LET_GWD_DEVICE_BEEP;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    if (arg.IPAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found IPAddress',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }

    const tmpData = {};
    tmpData.MACAddress = arg.MACAddress;
    tmpData.IPAddress = arg.IPAddress;

    const message = apiCore.method.getBeepPacket(tmpData, true);
    udpServer.default.send(message, '255.255.255.255', 55954);

    event.sender.send(eventName, {
      success: true,
      msg: 'Set successful',
      data: { MACAddress: arg.MACAddress },
    });
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - device gwd beep error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_GWD_DEVICE_NETWORK_SETTINGS, (event, arg) => {
  const eventName = `${RESPONSE_RP_SET_GWD_DEVICE_NETWORK_SETTINGS} ${arg.MACAddress}`;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    if (arg.oldIPAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found oldIPAddress',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    if (arg.newIPAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found newIPAddress',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    if (arg.netmask === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found netmask',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    if (arg.gateway === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found gateway',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    if (arg.hostname === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found hostname',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }
    const authSetting = deviceAuthManagement.default.getDeviceAuth(
      arg.MACAddress,
    );
    if (!authSetting.success) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get device authentication fail',
        data: { MACAddress: arg.MACAddress },
      });
      return;
    }

    const tmpData = {
      MACAddress: arg.MACAddress,
      oldIPAddress: arg.oldIPAddress,
      newIPAddress: arg.newIPAddress, // 0.0.0.0 is DHCP mode
      netmask: arg.netmask,
      gateway: arg.gateway,
      hostname: arg.hostname,
      username: authSetting.data.username,
      password: authSetting.data.password,
    };
    const message = apiCore.method.getConfigPacket(tmpData, true);
    udpServer.default.send(message, '255.255.255.255', 55954);

    gwdAckWaitingList[arg.MACAddress] = {
      event,
      eventName,
      timeout: setTimeout(() => {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - gwd device network settings timeout',
          data: { MACAddress: arg.MACAddress },
        });
        delete gwdAckWaitingList[arg.MACAddress];
      }, 2000),
    };
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - gwd device network settings error',
    });
  }
});
