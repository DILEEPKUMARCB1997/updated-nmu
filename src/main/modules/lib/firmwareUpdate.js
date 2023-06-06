import { ipcMain, dialog } from 'electron';
import net from 'net';
import fs from 'fs';
import async from 'async';
import _ from 'lodash';
import {
  apiCore,
  windowManagement,
  queueManagement,
  iniReader,
  advancedManagement,
} from '..';
import {
  REQUEST_MP_START_FIRMWARE_UPDATE,
  RESPONSE_RP_START_FIRMWARE_UPDATE,
  REQUEST_MP_OPEN_FILE_DIALOG,
  RESPONSE_RP_OPEN_FILE_DIALOG,
  REQUEST_MP_STOP_FIRMWARE_UPDATE,
  RESPONSE_RP_STOP_FIRMWARE_UPDATE,
  SEND_RP_FIRMWARE_UPDATE_PROGRESS,
} from '../../utils/IPCEvents';

let fwChunk = [];
const firmwareUpdateParams = {
  connTimeout: 2000,
  writeFlashTime: 480000,
  batchQuantity: 1,
};

let fwPath = '';
let fw = null;
let deviceTcpClient = {};
let deviceUploadProgress = {};

function initializeFirmware(data) {
  try {
    const config = iniReader.default.getConfig();
    const result = advancedManagement.default.getFwUpdateAdvancedSettings();

    if (!result.success) {
      dialog.showErrorBox('Error!', 'loading firmware update setting Error!');
      throw new Error('loading firmware update setting Error!');
    }

    firmwareUpdateParams.connTimeout = result.data.fwUpdateConnTimeout;
    firmwareUpdateParams.writeFlashTime =
      config.firmwareUpdate.writeFlashTime * 1000;
    firmwareUpdateQueue.concurrency = result.data.fwUpdateBatchQuantity;

    fw = fs.readFileSync(fwPath);
    const dlRequest = apiCore.method.getDownloadRequest(
      { fileSize: fw.length },
      true,
    );
    if (dlRequest === null) {
      dialog.showErrorBox('Error!', 'loading download request Error!');
      throw new Error('loading download request Error!');
    }
    fwChunk = [];
    // create fiemware chunk
    fwChunk.push(dlRequest);
    for (let i = 0; i < fw.length; i += 512) {
      fwChunk.push(fw.slice(i, i + 512));
    }

    // init deviceTcpClient and deviceUploadProgress
    deviceTcpClient = {};
    deviceUploadProgress = {
      isDone: false,
      deviceList: _.cloneDeep(data.deviceList),
    };

    Object.keys(deviceUploadProgress.deviceList).forEach(MACAddress => {
      deviceUploadProgress.deviceList[MACAddress].uploadProgress = 0;
      deviceUploadProgress.deviceList[MACAddress].code = 'none';
      queueManagement.default.add(firmwareUpdateQueue, {
        MACAddress,
        IPAddress: deviceUploadProgress.deviceList[MACAddress].IPAddress,
      });
    });
  } catch (error) {
    console.error(error);
    windowManagement.default.send('mainId', SEND_RP_FIRMWARE_UPDATE_PROGRESS, {
      isDone: true,
    });
  }
}

function refreshFirmwareUpdateStatus(MACAddress) {
  try {
    const deviceUploadInfo = _.cloneDeep(
      deviceUploadProgress.deviceList[MACAddress],
    );
    deviceUploadInfo.MACAddress = MACAddress;

    windowManagement.default.send(
      'mainId',
      SEND_RP_FIRMWARE_UPDATE_PROGRESS,
      deviceUploadInfo,
    );
    //console.log(deviceUploadInfo);
  } catch (error) {
    console.error(error);
  }
}

const firmwareUpdateQueue = async.queue((tmp, callback) => {
  function sendPacket(msg, _callback) {
    // code to show your custom alert
    // in this case its just a console log
    deviceTcpClient[tmp.MACAddress].client.write(msg);

    // do callback when ready
    deviceTcpClient[tmp.MACAddress].callback = _callback;
  }
  try {
    let packetCount = 0;
    const uploadImage = arr => {
      sendPacket(arr[packetCount], () => {
        // set packetCount to next item
        packetCount += 1;
        // any more items in array? continue loop
        if (packetCount < arr.length) {
          uploadImage(arr);
        }
        // show firmware upload percentComplete
        const proc = ((packetCount - 1) * 100) / Math.ceil(fw.length / 512);
        const progressPercent = Math.floor(proc * 100) / 100;
        deviceUploadProgress.deviceList[
          tmp.MACAddress
        ].uploadProgress = progressPercent;

        // console.log(Math.floor(proc * 100) / 100);
      });
    };

    deviceTcpClient[tmp.MACAddress] = {
      interval: setInterval(refreshFirmwareUpdateStatus, 250, tmp.MACAddress),
      // create TCP socket for device
      client: new net.Socket(),
      // set connect timeout
      timeout: setTimeout(() => {
        deviceTcpClient[tmp.MACAddress].client.destroy();
      }, firmwareUpdateParams.connTimeout),
    };

    deviceTcpClient[tmp.MACAddress].client.connect(55950, tmp.IPAddress, () => {
      // console.log(`Connected ${tmp.IPAddress}`);
      uploadImage(fwChunk);
    });

    deviceTcpClient[tmp.MACAddress].client.on('data', data => {
      clearTimeout(deviceTcpClient[tmp.MACAddress].timeout);
      deviceUploadProgress.deviceList[tmp.MACAddress].code = data.toString();
      switch (data.toString()) {
        case 'a':
          deviceTcpClient[tmp.MACAddress].callback();
          deviceTcpClient[tmp.MACAddress].timeout = setTimeout(() => {
            deviceTcpClient[tmp.MACAddress].client.destroy();
          }, firmwareUpdateParams.connTimeout);
          break;
        case 'S001':
          deviceTcpClient[tmp.MACAddress].timeout = setTimeout(() => {
            deviceTcpClient[tmp.MACAddress].client.destroy();
          }, firmwareUpdateParams.writeFlashTime);
          clearInterval(deviceTcpClient[tmp.MACAddress].interval);
          refreshFirmwareUpdateStatus(tmp.MACAddress);
          break;
        case 'S002':
          deviceTcpClient[tmp.MACAddress].client.destroy();
          break;
        case 'E001':
          deviceTcpClient[tmp.MACAddress].client.destroy();
          break;
        case 'E007':
          deviceTcpClient[tmp.MACAddress].client.destroy();
          break;
        default:
          deviceTcpClient[tmp.MACAddress].client.destroy();
          break;
      }
    });

    deviceTcpClient[tmp.MACAddress].client.on('error', err => {
      deviceTcpClient[tmp.MACAddress].client.destroy();
      console.log(err.code);
    });

    deviceTcpClient[tmp.MACAddress].client.on('close', () => {
      //console.log('Connection closed');
      const statusCode = deviceUploadProgress.deviceList[tmp.MACAddress].code;
      if (
        statusCode === 'none' ||
        statusCode === 'a' ||
        statusCode === 'S001'
      ) {
        deviceUploadProgress.deviceList[tmp.MACAddress].code = 'TO';
      }

      callback();
      clearInterval(deviceTcpClient[tmp.MACAddress].interval);
      refreshFirmwareUpdateStatus(tmp.MACAddress);
      queueManagement.default.add(checkFirmwareUpdateQueue, {});
    });
  } catch (error) {
    clearTimeout(deviceTcpClient[tmp.MACAddress].timeout);
    const statusCode = deviceUploadProgress.deviceList[tmp.MACAddress].code;
    if (statusCode === 'none' || statusCode === 'a' || statusCode === 'S001') {
      deviceUploadProgress.deviceList[tmp.MACAddress].code = 'TO';
    }
    callback();
    clearInterval(deviceTcpClient[tmp.MACAddress].interval);
    refreshFirmwareUpdateStatus(tmp.MACAddress);
    queueManagement.default.add(checkFirmwareUpdateQueue, {});
  }
}, 10);

const checkFirmwareUpdateQueue = async.queue((tmp, callback) => {
  try {
    if (firmwareUpdateQueue.length() === 0 && !deviceUploadProgress.isDone) {
      deviceUploadProgress.isDone = true;
      fwPath = '';
      checkFirmwareUpdateQueue.kill();
      windowManagement.default.send(
        'mainId',
        SEND_RP_FIRMWARE_UPDATE_PROGRESS,
        {
          isDone: true,
        },
      );
    }
    callback();
  } catch (error) {
    console.error(error);
    callback();
  }
}, 1);

ipcMain.on(REQUEST_MP_OPEN_FILE_DIALOG, async event => {
  const eventName = RESPONSE_RP_OPEN_FILE_DIALOG;
  try {
    const mainWindow = windowManagement.default.getWindow('mainId');
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'dld', extensions: ['dld'] }],
      properties: ['openFile'],
    });
    if (result.filePaths !== undefined) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get firmware path successful',
        data: result.filePaths,
      });
      const selectPath = result.filePaths[0];
      fwPath = selectPath;
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - user cancel',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - open file dialog error',
    });
  }
});

ipcMain.on(REQUEST_MP_START_FIRMWARE_UPDATE, (event, arg) => {
  const eventName = RESPONSE_RP_START_FIRMWARE_UPDATE;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    const data = JSON.parse(arg);
    if (fwPath === '') {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found firmware path',
      });
      return;
    }
    if (!fs.existsSync(fwPath)) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not exists firmware path',
      });
      return;
    }
    if (data.deviceList === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found device list',
      });
      return;
    }
    if (Object.keys(data.deviceList).length <= 0) {
      event.sender.send(eventName, {
        success: false,
        msg: 'DeviceList is empty',
      });
      return;
    }
    if (firmwareUpdateQueue.length() !== 0) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Firmware update is running',
      });
      return;
    }

    const tmpArr = [];
    Object.keys(data.deviceList).forEach(key => {
      if (tmpArr.includes(data.deviceList[key].IPAddress)) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - duplicate IP address',
        });
        return;
      }
      tmpArr.push(data.deviceList[key].IPAddress);
    });

    event.sender.send(eventName, {
      success: true,
      msg: 'Firmware update start successful',
    });
    initializeFirmware(data);
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - start firmware update error',
    });
  }
});

ipcMain.on(REQUEST_MP_STOP_FIRMWARE_UPDATE, event => {
  const eventName = RESPONSE_RP_STOP_FIRMWARE_UPDATE;
  try {
    // clear queue
    firmwareUpdateQueue.kill();

    Object.keys(deviceUploadProgress.deviceList).forEach(MACAddress => {
      if (deviceUploadProgress.deviceList[MACAddress].code === 'a') {
        deviceUploadProgress.deviceList[MACAddress].code = 'c';
        clearTimeout(deviceTcpClient[MACAddress].timeout);
        deviceTcpClient[MACAddress].client.destroy();
      }
    });

    event.sender.send(eventName, {
      success: true,
      msg: 'Firmware update stop successful',
    });
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - stop firmware update error',
    });
  }
});
