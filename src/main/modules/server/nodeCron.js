import cron from 'node-cron';
import { apiCore, udpServer } from '..';
import _ from 'lodash';
import { datePad } from '../common/tools';
import fs from 'fs';
import mv from 'mv';
import netSNMP from 'net-snmp';
import getDeviceAuth from '../database/deviceAuthManagement';
import getDeviceOnlineList from '../lib/deviceIntegration';
import { snmp, mibs, iFaceManagement } from '..';
import { startServer, closeServer, isServerAlive } from '../server/TFTPServer';
// const Telnet = require('telnet-client');
// const connection = new Telnet();
import { tlenetClient } from './telnetClient';
const pathRoot = require('path');

const rootFolderPath =
  process.env.APPDATA ||
  (process.platform == 'darwin'
    ? process.env.HOME + '/Library/Preferences'
    : process.env.HOME + '/.local/share');
const root = pathRoot.join(rootFolderPath, '/NMUbackupConfigs/');

function start() {
  scheduleBackup();
}
let deviceScheduleList = {};
function getScheduleBackupData() {
  try {
    const scheduleData = JSON.parse(apiCore.db.getScheduleData({}, true));
    return {
      success: true,
      msg: 'Get schedule data successful',
      data: scheduleData,
    };
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - get schedule data fail' };
  }
}

function scheduleBackup() {
  const scheduledBackup = {};
  const scheduledData = getScheduleBackupData();

  if (!scheduledData.success) {
    // error msg
  } else {
    deviceScheduleList = _.cloneDeep(scheduledData.data);
    Object.keys(deviceScheduleList).forEach(scheduleId => {
      scheduledBackup[scheduleId] = {
        scheduleId: deviceScheduleList[scheduleId].scheduleId,
        scheduleName: deviceScheduleList[scheduleId].scheduleName,
        frequency: deviceScheduleList[scheduleId].frequency,
        scheduleDate: deviceScheduleList[scheduleId].scheduleDate,
        scheduleTime: deviceScheduleList[scheduleId].scheduleTime,
        weeekDay: deviceScheduleList[scheduleId].weeekDay,
        customFrequency: deviceScheduleList[scheduleId].customFrequency,
        deviceList: deviceScheduleList[scheduleId].deviceList,
      };
    });

    const schedule = Object.keys(scheduledBackup);
    //console.log(schedule);
    schedule.forEach(scheduleId => {
      const devices = [];
      const scheuledId = scheduledBackup[scheduleId].scheduleId;
      const frequency = scheduledBackup[scheduleId].frequency;
      const scheduleDate = scheduledBackup[scheduleId].scheduleDate;
      const scheduleTime = scheduledBackup[scheduleId].scheduleTime;
      const weeekDay = scheduledBackup[scheduleId].weeekDay;
      const now = new Date(scheduleDate + ' ' + scheduleTime);
      const nowYear = datePad(now.getFullYear().toString());
      const nowMonth = datePad(now.getMonth() + 1).toString();
      const nowDate = datePad(now.getDate().toString());
      const nowHours = datePad(now.getHours().toString());
      const nowMinutes = datePad(now.getMinutes().toString());

      Object.keys(scheduledBackup[scheduleId].deviceList).forEach(
        MACAddress => {
          devices.push(
            scheduledBackup[scheduleId].deviceList[MACAddress].MACAddress,
          );
        },
      );
      if (frequency === 1) {
        cron.schedule(
          nowMinutes + ' ' + nowHours + ' ' + nowDate + ' ' + nowMonth + ' *',
          () => {
            deviceBackup(devices, scheuledId);
            //dummy(devices, scheuledId);
          },
        );
      }
      if (frequency === 2) {
        cron.schedule(nowMinutes + ' ' + nowHours + ' * * *', () => {
          deviceBackup(devices, scheuledId);
          //dummy(devices, scheuledId);
        });
      }
      if (frequency === 3) {
        cron.schedule(nowMinutes + ' ' + nowHours + ' * * ' + weeekDay, () => {
          deviceBackup(devices, scheuledId);
          //dummy(devices, scheuledId);
        });
      }
    });
  }
}

function dummy(devices, scheuledId) {
  //console.log(scheuledId);
  //console.log(devices);
}

function deviceBackup(devices, scheduleId) {
  //console.log(devices);
  try {
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
          //negotiationMandatory: false,
          timeout: 10000,
          loginPrompt: 'Username: ',
          passwordPrompt: 'Password: ',
          username: getDeviceAuth.getDeviceAuth(MACAddress).data.username,
          password: getDeviceAuth.getDeviceAuth(MACAddress).data.password,
        };
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

        SNMPSessionList[MACAddress].rw.set(oids, err => {
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
            updateStatus(MACAddress, 'SUCCESS', scheduleId);
          } catch (error) {
            const finish = devicesCount === 0;
            singleBackupErrorHandler(finish, MACAddress, error, scheduleId);
          }
        });
      } catch (error) {
        const finish = devicesCount === 0;
        singleBackupErrorHandler(finish, MACAddress, error, scheduleId);
      }
    });
  } catch (error) {
    backupErrorHandler(error);
  }
}

const backupErrorHandler = error => {
  if (isServerAlive()) {
    closeServer();
  }
  //failuer by macAddress

  console.error(error);
};

const singleBackupErrorHandler = (finish, MACAddress, error, scheduleId) => {
  if (finish && isServerAlive()) {
    closeServer();
  }
  //failuer by macAddress
  updateStatus(MACAddress, 'FAILURE', scheduleId);
  console.error(error);
};

const updateStatus = (MACAddress, status, scheduleId) => {
  //console.log(MACAddress);
  //console.log(scheduleId);
  //console.log(status);
  try {
    const result = apiCore.db.updateScheduleDeviceStatus(
      { scheduleId: scheduleId, MACAddress: MACAddress, status: status },
      true,
    );
    console.log(result);
    //getScheduledData;
    //ipcRenderer.send(REQUEST_MP_GET_THE_SCHEDULE_BACKUP_DATA, {});
    //return { success: true, msg: 'Get schedule data successful', data: result };
  } catch (error) {
    console.error(error);
    //return { success: false, msg: 'Error in - get schedule data fail' };
    //ipcRenderer.send(REQUEST_MP_GET_THE_SCHEDULE_BACKUP_DATA, {});
  }
};

export default { start };
