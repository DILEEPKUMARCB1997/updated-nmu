import { ipcMain } from 'electron';
import fs from 'fs';
import netSNMP from 'net-snmp';
import {
  REQUEST_MP_TRAP_SETTING,
  RESPONSE_RP_TRAP_SETTING,
} from '../../utils/IPCEvents';
import { snmp, mibs, iFaceManagement } from '..';
import { startServer, closeServer, isServerAlive } from '../server/TFTPServer';

ipcMain.on(REQUEST_MP_TRAP_SETTING, (event, arg) => {
  try {
    const { devices, param } = arg;
    const host = iFaceManagement.default.getCurrentNetworkInterface().data
      .IPAddress;
    const mib = mibs.default.getMib();
    const SNMPSessionList = snmp.default.getSNMPSessionList();
    //console.log(devices);
    //console.log(arg.param);
    const {
      snmpTrapServerStatus,
      snmpTrapServerIP,
      snmpTrapServerPort,
      snmpTrapServerTrapComm,
    } = mib.private.trapSetting;
    if (!isServerAlive()) {
      startServer(host);
    }

    let devicesCount = devices.length;
    let devicesCountTimeout = devices.length;

    devices.forEach(MACAddress => {
      try {
        const { sysObjectId } = SNMPSessionList[MACAddress];
        const { saveCfgMgtAction } = mib.private.basicSetting.saveConfig;
        const { systemRebootAction } = mib.private.basicSetting.systemReboot;
        const oids = [
          {
            oid: sysObjectId + snmpTrapServerStatus,
            type: netSNMP.ObjectType.Integer,
            value: 2,
          },
          {
            oid: sysObjectId + snmpTrapServerIP,
            type: netSNMP.ObjectType.OctetString,
            value: param.trapServerIP,
          },
          {
            oid: sysObjectId + snmpTrapServerPort,
            type: netSNMP.ObjectType.Integer,
            value: param.trapServerPort,
          },
          {
            oid: sysObjectId + snmpTrapServerTrapComm,
            type: netSNMP.ObjectType.OctetString,
            value: param.trapCommString,
          },
        ];

        const saveConfigOids = [
          {
            oid: sysObjectId + saveCfgMgtAction,
            type: netSNMP.ObjectType.Integer,
            value: 1,
          },
          {
            oid: sysObjectId + systemRebootAction,
            type: netSNMP.ObjectType.Integer,
            value: 1,
          },
        ];

        SNMPSessionList[MACAddress].rw.set(oids, trapErr => {
          try {
            devicesCount -= 1;
            if (trapErr) throw trapErr;
            setTimeout(() => {
              SNMPSessionList[MACAddress].rw.set(saveConfigOids, rebootErr => {
                try {
                  devicesCountTimeout -= 1;
                  if (rebootErr) throw rebootErr;
                  const finish =
                    devicesCount === 0 && devicesCountTimeout === 0;
                  if (finish && isServerAlive) {
                    closeServer();
                  }
                  event.sender.send(RESPONSE_RP_TRAP_SETTING, {
                    success: true,
                    type: 2,
                    data: { finish, MACAddress },
                  });
                } catch (error) {
                  //console.log('finish 1');
                  const finish =
                    devicesCount === 0 && devicesCountTimeout === 0;
                  singleTrapErrorHandler(event, finish, MACAddress, error);
                }
              });
            }, 3000);
          } catch (error) {
            const finish = devicesCount === 0;
            singleTrapErrorHandler(event, finish, MACAddress, error);
          }
        });
      } catch (error) {
        const finish = devicesCount === 0;
        singleTrapErrorHandler(event, finish, MACAddress, error);
      }
    });
  } catch (error) {
    TrapErrorHandler(event, error);
  }
});

const TrapErrorHandler = (event, error) => {
  if (isServerAlive()) {
    closeServer();
  }
  event.sender.send(RESPONSE_RP_TRAP_SETTING, {
    success: false,
    type: 1,
    data: { finish: true },
  });
  console.error(error);
};

const singleTrapErrorHandler = (event, finish, MACAddress, error) => {
  if (finish && isServerAlive()) {
    closeServer();
  }
  event.sender.send(RESPONSE_RP_TRAP_SETTING, {
    success: false,
    type: 2,
    data: { finish, MACAddress },
  });
  console.error(error);
};
