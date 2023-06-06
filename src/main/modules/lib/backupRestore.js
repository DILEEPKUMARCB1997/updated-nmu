import { ipcMain } from 'electron';
import fs from 'fs';
import mv from 'mv';
import netSNMP from 'net-snmp';
import getDeviceAuth from '../database/deviceAuthManagement';
import getDeviceOnlineList from './deviceIntegration';
import {
  REQUEST_MP_GET_CONFIG_FILES,
  RESPONSE_RP_GET_CONFIG_FILES,
  REQUEST_MP_BACKUP_CONFIG,
  RESPONSE_RP_BACKUP_CONFIG,
  REQUEST_MP_RESTORE_CONFIG,
  RESPONSE_RP_RESTORE_CONFIG,
  REQUEST_MP_DELETE_CONFIG_FILE,
  RESPONSE_RP_DELETE_CONFIG_FILE,
  REQUEST_MP_GET_ALL_FILES,
  RESPONSE_RP_GET_ALL_FILES,
} from '../../utils/IPCEvents';
import { snmp, mibs, iFaceManagement } from '..';
import { startServer, closeServer, isServerAlive } from '../server/TFTPServer';
import { datePad } from '../common/tools';
// const Telnet = require('telnet-client');
import { tlenetClient } from '../server/telnetClient';

const pathRoot = require('path');

const rootFolderPath =
  process.env.APPDATA ||
  (process.platform == 'darwin'
    ? process.env.HOME + '/Library/Preferences'
    : process.env.HOME + '/.local/share');
const root = pathRoot.join(rootFolderPath, '/NMUbackupConfigs/');

ipcMain.on(REQUEST_MP_GET_ALL_FILES, (event, arg) => {
  const files = {};
  const { devices } = arg;
  devices.forEach(MACAddress => {
    const path = root + MACAddress.replace(/:/g, '');
    files[MACAddress] = [];
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach(file => {
        //console.log('log1');
        //console.log(file.indexOf('.txt') !== -1);
        //.log(file);
        if (file.indexOf('.txt') !== -1) {
        } else files[MACAddress].push(file);
      });
    }
  });

  event.sender.send(RESPONSE_RP_GET_ALL_FILES, {
    success: true,
    data: {
      files,
    },
  });
});

ipcMain.on(REQUEST_MP_GET_CONFIG_FILES, (event, arg) => {
  const { MACAddress } = arg;
  const files = [];
  const path = root + MACAddress.replace(/:/g, '');
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(file => {
      //console.log('log2');
      //console.log(file);
      if (file.indexOf('.txt') !== -1) {
      } else files.push(file);
    });
  }

  event.sender.send(RESPONSE_RP_GET_CONFIG_FILES, {
    success: true,
    data: {
      files,
    },
  });
});

ipcMain.on(REQUEST_MP_BACKUP_CONFIG, async (event, arg) => {
  try {
    const { devices } = arg;
    const host = iFaceManagement.default.getCurrentNetworkInterface().data
      .IPAddress;
    const mib = mibs.default.getMib();
    const SNMPSessionList = snmp.default.getSNMPSessionList();
    const {
      backupServerIP,
      backupAgentBoardFwFileName,
      backupStatus,
    } = mib.private.basicSetting.backupAndRestore;

    if (!isServerAlive()) {
      startServer(host);
    }

    let devicesCount = devices.length;

    devices.forEach(async MACAddress => {
      try {
        //const connection = new Telnet();
        const fileMAC = MACAddress.replace(/:/g, '');
        const now = new Date();
        const nowYear = datePad(now.getFullYear().toString());
        const nowMonth = datePad((now.getMonth() + 1).toString());
        const nowDate = datePad(now.getDate().toString());
        const nowHours = datePad(now.getHours().toString());
        const nowMinutes = datePad(now.getMinutes().toString());
        const nowSeconds = datePad(now.getSeconds().toString());

        const fileDate =
          nowYear + nowMonth + nowDate + nowHours + nowMinutes + nowSeconds;
        const filename = `${fileMAC}_${fileDate}`;

        const path = root + fileMAC;
        const { sysObjectId } = SNMPSessionList[MACAddress];
        const telnetData = {
          host: getDeviceOnlineList.getDeviceOnlineList()[MACAddress].IPAddress,
          port: 23,
          //shellPrompt: "/ # ", // or
          // negotiationMandatory: false,
          timeout: 1500,
          loginPrompt: 'Username: ',
          passwordPrompt: 'Password: ',
          username: getDeviceAuth.getDeviceAuth(MACAddress).data.username,
          password: getDeviceAuth.getDeviceAuth(MACAddress).data.password,
        };
        // console.log(telnetData);
        await tlenetClient(telnetData, filename, host, MACAddress, path);
        const oids = [
          {
            oid: sysObjectId + backupServerIP,
            type: netSNMP.ObjectType.OctetString,
            value: host,
          },
          {
            oid: sysObjectId + backupAgentBoardFwFileName,
            type: netSNMP.ObjectType.OctetString,
            value: filename,
          },
          {
            oid: sysObjectId + backupStatus,
            type: netSNMP.ObjectType.Integer,
            value: 1,
          },
        ];

        SNMPSessionList[MACAddress].rw.set(oids, async err => {
          try {
            devicesCount -= 1;
            const finish = devicesCount === 0;
            if (err) throw err;
            if (!fs.existsSync(path)) {
              fs.mkdirSync(path);
            }
            fs.renameSync(`${root}${filename}`, `${path}/${filename}`);
            // fs.renameSync(`${root}${filename}.txt`, `${path}/${filename}.txt`);
            if (finish && isServerAlive()) {
              // closeServer();
            }
            event.sender.send(RESPONSE_RP_BACKUP_CONFIG, {
              success: true,
              type: 2,
              data: { finish, MACAddress },
            });
          } catch (error) {
            const finish = devicesCount === 0;
            singleBackupErrorHandler(event, finish, MACAddress, error);
          }
        });
      } catch (error) {
        const finish = devicesCount === 0;
        singleBackupErrorHandler(event, finish, MACAddress, error);
      }
    });
  } catch (error) {
    backupErrorHandler(event, error);
  }
});

const backupErrorHandler = (event, error) => {
  if (isServerAlive()) {
    closeServer();
  }
  event.sender.send(RESPONSE_RP_BACKUP_CONFIG, {
    success: false,
    type: 1,
    data: { finish: true },
  });
  console.error(error);
};

const singleBackupErrorHandler = (event, finish, MACAddress, error) => {
  if (finish && isServerAlive()) {
    closeServer();
  }
  event.sender.send(RESPONSE_RP_BACKUP_CONFIG, {
    success: false,
    type: 2,
    data: { finish, MACAddress },
  });
  console.error(error);
};

ipcMain.on(REQUEST_MP_DELETE_CONFIG_FILE, (event, arg) => {
  try {
    const { MACAddress, file } = arg;
    const path = `${root + MACAddress.replace(/:/g, '')}/${file}`;

    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
    event.sender.send(RESPONSE_RP_DELETE_CONFIG_FILE, {
      success: true,
    });
  } catch (exception) {
    console.error(exception);
    event.sender.send(RESPONSE_RP_DELETE_CONFIG_FILE, {
      success: false,
    });
  }
});

ipcMain.on(REQUEST_MP_RESTORE_CONFIG, (event, arg) => {
  try {
    const restoreSetting = Object.entries(arg.restoreSetting);
    const host = iFaceManagement.default.getCurrentNetworkInterface().data
      .IPAddress;
    const mib = mibs.default.getMib();
    const SNMPSessionList = snmp.default.getSNMPSessionList();
    const {
      restoreServerIP,
      restoreAgentBoardFwFileName,
      restoreStatus,
    } = mib.private.basicSetting.backupAndRestore;

    if (!isServerAlive()) {
      startServer(host);
    }

    let devicesCount = restoreSetting.length;

    restoreSetting.forEach(([MACAddress, file]) => {
      try {
        const restorePath = `${root + MACAddress.replace(/:/g, '')}/${file}`;
        const rootFile = root + file;

        fs.copyFileSync(restorePath, rootFile);
        const { sysObjectId } = SNMPSessionList[MACAddress];
        const { systemRebootAction } = mib.private.basicSetting.systemReboot;
        const restoreOids = [
          {
            oid: sysObjectId + restoreServerIP,
            type: netSNMP.ObjectType.OctetString,
            value: host,
          },
          {
            oid: sysObjectId + restoreAgentBoardFwFileName,
            type: netSNMP.ObjectType.OctetString,
            value: file,
          },
          {
            oid: sysObjectId + restoreStatus,
            type: netSNMP.ObjectType.Integer,
            value: 1,
          },
        ];

        const rebootOids = [
          {
            oid: sysObjectId + systemRebootAction,
            type: netSNMP.ObjectType.Integer,
            value: 1,
          },
        ];

        SNMPSessionList[MACAddress].rw.set(restoreOids, restoreErr => {
          try {
            if (restoreErr) throw restoreErr;
            setTimeout(() => {
              SNMPSessionList[MACAddress].rw.set(rebootOids, rebootErr => {
                try {
                  devicesCount -= 1;
                  if (rebootErr) throw rebootErr;
                  const finish = devicesCount === 0;
                  fs.unlinkSync(rootFile);
                  if (finish && isServerAlive) {
                    closeServer();
                  }
                  event.sender.send(RESPONSE_RP_RESTORE_CONFIG, {
                    success: true,
                    data: { MACAddress, finish },
                  });
                } catch (error) {
                  //console.log('finish 1');
                  const finish = devicesCount === 0;
                  singleRestoreErrorHandler(event, finish, MACAddress, error);
                }
              });
            }, 3000);
          } catch (error) {
            //console.log('finish 2');
            const finish = devicesCount === 0;
            singleRestoreErrorHandler(event, finish, MACAddress, error);
          }
        });
      } catch (error) {
        //console.log('finish 3');
        const finish = devicesCount === 0;
        singleRestoreErrorHandler(event, finish, MACAddress, error);
      }
    });
  } catch (error) {
    restoreErrorHandler(event, error);
  }
});

const restoreErrorHandler = (event, error) => {
  console.error(error);

  if (isServerAlive()) {
    closeServer();
  }

  event.sender.send(RESPONSE_RP_RESTORE_CONFIG, {
    success: false,
    type: 1,
    data: { finish: true },
  });
};

const singleRestoreErrorHandler = (event, finish, MACAddress, error) => {
  if (finish && isServerAlive()) {
    closeServer();
  }
  event.sender.send(RESPONSE_RP_RESTORE_CONFIG, {
    success: false,
    type: 2,
    data: { finish, MACAddress },
  });
  console.error(error);
};
