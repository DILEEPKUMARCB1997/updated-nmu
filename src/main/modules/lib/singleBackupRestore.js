import { ipcMain, dialog } from 'electron';
import fs from 'fs';
import mv from 'mv';
import path from 'path';
import netSNMP from 'net-snmp';
import { snmp, mibs, iFaceManagement, windowManagement } from '..';
import getDeviceAuth from '../database/deviceAuthManagement';
import getDeviceOnlineList from './deviceIntegration';
import { tlenetClient } from '../server/telnetClient';
import {
  REQUEST_MP_SINGLE_BACKUP_SELECT_FOLDER,
  RESPONSE_RP_SINGLE_BACKUP_SELECT_FOLDER,
  REQUEST_MP_SINGLE_BACKUP_CONFIG,
  RESPONSE_RP_SINGLE_BACKUP_CONFIG,
  REQUEST_MP_SINGLE_BACKUP_RESTORE_DATA,
  RESPONSE_RP_SINGLE_BACKUP_RESTORE_DATA,
  REQUEST_MP_SINGLE_RESTORE_SELECT_FILE,
  RESPONSE_RP_SINGLE_RESTORE_SELECT_FILE,
  REQUEST_MP_SINGLE_RESTORE_CONFIG,
  RESPONSE_RP_SINGLE_RESTORE_CONFIG,
} from '../../utils/IPCEvents';
import { startServer, closeServer, isServerAlive } from '../server/TFTPServer';
//const Telnet = require('telnet-client');
//const connection = new Telnet();
import { result } from 'lodash';

const rootFolderPath =
  process.env.APPDATA ||
  (process.platform == 'darwin'
    ? process.env.HOME + '/Library/Preferences'
    : process.env.HOME + '/.local/share');
const root = path.join(rootFolderPath, '/NMUbackupConfigs/');

let absoluteBackupPath;

ipcMain.on(REQUEST_MP_SINGLE_BACKUP_RESTORE_DATA, (event, arg) => {
  const { MACAddress } = arg;
  const backupPath = root + MACAddress.replace(/:/g, '');
  absoluteBackupPath = path.resolve(backupPath);

  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath);
  }

  event.sender.send(RESPONSE_RP_SINGLE_BACKUP_RESTORE_DATA, {
    success: true,
    data: {
      backupPath: absoluteBackupPath,
    },
  });
});

ipcMain.on(REQUEST_MP_SINGLE_BACKUP_SELECT_FOLDER, async event => {
  const mainWindow = windowManagement.default.getWindow('mainId');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: absoluteBackupPath,
  });
  console.log(result);
  if (result.filePaths !== undefined) {
    const backupPath = result.filePaths[0];
    event.sender.send(RESPONSE_RP_SINGLE_BACKUP_SELECT_FOLDER, {
      success: true,
      data: {
        backupPath,
      },
    });
    absoluteBackupPath = backupPath;
  }
});

ipcMain.on(REQUEST_MP_SINGLE_BACKUP_CONFIG, async (event, arg) => {
  try {
    const { MACAddress, backupPath, filename } = arg;
    console.log(backupPath);
    const host = iFaceManagement.default.getCurrentNetworkInterface().data
      .IPAddress;
    const mib = mibs.default.getMib();
    const SNMPSessionList = snmp.default.getSNMPSessionList();
    const {
      backupServerIP,
      backupAgentBoardFwFileName,
      backupStatus,
    } = mib.private.basicSetting.backupAndRestore;

    const telnetData = {
      host: getDeviceOnlineList.getDeviceOnlineList()[MACAddress].IPAddress,
      port: 23,
      //shellPrompt: "/ # ", // or
      //negotiationMandatory: false,
      timeout: 15000,
      loginPrompt: 'Username: ',
      passwordPrompt: 'Password: ',
      username: getDeviceAuth.getDeviceAuth(MACAddress).data.username,
      password: getDeviceAuth.getDeviceAuth(MACAddress).data.password,
    };
    console.log(telnetData);

    if (!isServerAlive()) {
      startServer(host);
    }
    await tlenetClient(telnetData, filename, host, MACAddress, backupPath);
    const { sysObjectId } = SNMPSessionList[MACAddress];
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

    SNMPSessionList[MACAddress].rw.set(oids, err => {
      try {
        if (err) throw err;
        mv(`${root}${filename}`, `${backupPath}/${filename}`, function(errr) {
          if (errr) throw errr;
          event.sender.send(RESPONSE_RP_SINGLE_BACKUP_CONFIG, {
            success: true,
          });
        });
        //closeServer();
      } catch (error) {
        backupErrorHandler(event, error);
      }
    });
  } catch (error) {
    backupErrorHandler(event, error);
  }
});

const backupErrorHandler = (event, error) => {
  console.error(error);

  event.sender.send(RESPONSE_RP_SINGLE_BACKUP_CONFIG, {
    success: false,
  });

  if (isServerAlive()) {
    closeServer();
  }
};

ipcMain.on(REQUEST_MP_SINGLE_RESTORE_SELECT_FILE, async event => {
  const mainWindow = windowManagement.default.getWindow('mainId');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
  });
  if (result.filePaths !== undefined) {
    const restorePath = result.filePaths[0];
    event.sender.send(RESPONSE_RP_SINGLE_RESTORE_SELECT_FILE, {
      success: true,
      data: {
        restorePath,
      },
    });
  }
});

ipcMain.on(REQUEST_MP_SINGLE_RESTORE_CONFIG, (event, arg) => {
  let rootFile;
  try {
    const { MACAddress, restorePath } = arg;
    const filename = restorePath.split('\\').pop();
    rootFile = `${root}/${filename}`;

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

    fs.copyFileSync(`${restorePath}`, rootFile);

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
        value: filename,
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
              if (rebootErr) throw rebootErr;
              event.sender.send(RESPONSE_RP_SINGLE_RESTORE_CONFIG, {
                success: true,
              });
              closeServer();
              fs.unlinkSync(rootFile);
            } catch (error) {
              restoreErrorHandler(event, rootFile, error);
            }
          });
        }, 5000);
      } catch (error) {
        restoreErrorHandler(event, rootFile, error);
      }
    });
  } catch (error) {
    restoreErrorHandler(event, rootFile, error);
  }
});

const restoreErrorHandler = (event, rootFile, error) => {
  console.error(error);

  if (isServerAlive()) {
    closeServer();
  }

  if (fs.existsSync(rootFile)) {
    fs.unlinkSync(rootFile);
  }

  event.sender.send(RESPONSE_RP_SINGLE_RESTORE_CONFIG, {
    success: false,
  });
};
