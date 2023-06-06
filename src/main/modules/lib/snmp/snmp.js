/* eslint-disable no-use-before-define */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable import/no-cycle */
import { ipcMain, ipcRenderer } from 'electron';
import { getIPRange } from 'get-ip-range';
import ping from 'ping';
import async from 'async';
import snmp from 'net-snmp';
import _ from 'lodash';
import startAnyFaultPolling from '../anyFault';
import {
  REQUEST_MP_CHECK_SNMP,
  RESPONSE_RP_CHECK_SNMP,
  REQUEST_MP_GET_ALARM_SETTINGS,
  RESPONSE_RP_GET_ALARM_SETTINGS,
  REQUEST_MP_LET_SNMP_DEVICE_REBOOT,
  RESPONSE_RP_LET_SNMP_DEVICE_REBOOT,
  REQUEST_MP_LET_SNMP_DEVICE_BEEP,
  REQUEST_MP_GET_PORT_INFORMATION,
  RESPONSE_RP_GET_PORT_INFORMATION,
  REQUEST_MP_SET_PORT_LINK_STATUS,
  RESPONSE_RP_SET_PORT_LINK_STATUS,
  REQUEST_MP_GET_SNMP_DEVICE_NETWORK_SETTINGS,
  RESPONSE_RP_GET_SNMP_DEVICE_NETWORK_SETTINGS,
  REQUEST_MP_SET_SNMP_DEVICE_NETWORK_SETTINGS,
  RESPONSE_RP_SET_SNMP_DEVICE_NETWORK_SETTINGS,
  REQUEST_MP_GET_POWER_STATUS,
  RESPONSE_RP_GET_POWER_STATUS,
  RESPONSE_RP_LET_SNMP_DEVICE_BEEP,
  SEND_RP_SNMP_SCAN_STATUS,
  REQUEST_MP_RESET_TO_DEFAULT,
  RESPONSE_RP_RESET_TO_DEFAULT,
  REQUEST_MP_GET_DEVICE_PROPERTIES,
  RESPONSE_RP_GET_DEVICE_PROPERTIES,
  REQUEST_MP_LOG_DISCOVERY,
  REQUEST_MP_LOG_EXCEPTION,
} from '../../../utils/IPCEvents';
import {
  progressManagement,
  alarmManagement,
  ipRangeManagement,
  windowManagement,
  queueManagement,
  deviceCommunityManagement,
  mibs,
  deviceIntegration,
  snmpManagement,
  topology,
  discoveryLog,
} from '../..';

let scanResIPList = [];
let scanOpenSnmpList = [];
let pollingResIPList = [];
const pollingOpenSnmpList = [];
let tmperoryMAC = [];

const snmpOptions = {
  // Default options
  port: 161,
  retries: 1,
  timeout: 3000,
  transport: 'udp4',
  trapPort: 162,
  version: snmp.Version2c,
  idBitsSize: 16,
};

// SNMP default community settings
const snmpCommunitySetting = {
  readCommunity: 'public',
  writeCommunity: 'private',
};
let pollingTaskParams = {
  timeout: undefined,
  callback: undefined,
};
let snmpPollInterval = 30; // min
let snmpSessionList = {};
let mib = {};

const CHECK_SNMP_POLLING_INTERVAL = 5000;
/* Add By AlexLin */
// check device snmp that is group

const checkSNMPPollingNext = (next) => {
  setTimeout(() => {
    next();
  }, snmpPollInterval * 1000 * 60);
};

const checkSNMPPolling = () => {
  console.log('SNMP check task start.');
  async.forever(
    (next) => {
      try {
        const checkIPList = [];
        // deviceIntegration.default.initializeList(true);
        const onlineDeviceList = Object.values(
          deviceIntegration.default.getDeviceOnlineList()
        );
        // console.log(onlineDeviceList);
        if (onlineDeviceList.length !== 0) {
          console.log('SNMP check begin.');
          onlineDeviceList.forEach((element) => {
            checkIPList.push(element.IPAddress);
          });
          checkSNMPFeature(checkIPList, () => {
            console.log('SNMP check finish.');
            if (
              !progressManagement.default.isProgressing('anyFault', 'polling')
            ) {
              // console.log('SNMP1.');
              startAnyFaultPolling(next);
            }
            // console.log('SNMP2.');
            checkSNMPPollingNext(next);
          });
        } else {
          // console.log('SNMP3.');
          checkSNMPPollingNext(next);
        }
      } catch (exception) {
        console.error(exception);
        // console.log('SNMP4.');
        checkSNMPPollingNext(next);
      }
    },
    (error) => {
      console.error(error);
    }
  );
};

const checkSNMPFeature = (checkIPList, getResult) => {
  try {
    mib = mibs.default.getMib();
    scanOpenSnmpList = [];
    async.series(
      {
        scanOid: (callback) => {
          const requests = checkIPList.map(
            (IPAddress) =>
              new Promise((resolve) =>
                getSysObjectId(IPAddress, false, resolve)
              )
          );
          checkStageDone(requests, 's', true, callback);
        },
        scanMACAddress: (callback) => {
          const requests = scanOpenSnmpList.map(
            (host) =>
              new Promise((resolve) => getMACAddress(host, false, resolve))
          );
          checkStageDone(requests, 's', true, callback);
        },
        scanInfo: (callback) => {
          const requests = Object.keys(snmpSessionList).map(
            (MACAddress) =>
              new Promise((resolve) => getModelInfo(MACAddress, false, resolve))
          );
          checkStageDone(requests, 'a', true, callback);
        },
      },
      () => {
        getResult({
          success: true,
        });
      }
    );
  } catch (error) {
    console.log(error);
    getResult({
      success: false,
    });
  }
};

ipcMain.on(REQUEST_MP_CHECK_SNMP, (event, arg) => {
  const { IPAddress, MACAddress } = arg;
  checkSNMPFeature([IPAddress], (result) => {
    if (result.success) {
      event.sender.send(RESPONSE_RP_CHECK_SNMP, {
        success: getSNMPSessionList()[MACAddress] !== undefined,
      });
    } else {
      event.sender.send(RESPONSE_RP_CHECK_SNMP, {
        success: false,
      });
    }
  });
});

ipcMain.on(REQUEST_MP_RESET_TO_DEFAULT, (event, arg) => {
  const MACAddressList = arg;
  MACAddressList.forEach((MACAddress) => {
    const { sysObjectId } = snmpSessionList[MACAddress];
    if (!mib.supportOid.includes(sysObjectId)) {
      event.sender.send(`${RESPONSE_RP_RESET_TO_DEFAULT} ${MACAddress}`, {
        success: false,
        msg: 'unknow device.',
      });
    }
    const { factoryDefaultAction } = mib.private.basicSetting.factoryDefault;
    const { systemRebootAction } = mib.private.basicSetting.systemReboot;

    const ResetOids = [
      {
        oid: sysObjectId + factoryDefaultAction,
        type: snmp.ObjectType.Integer,
        value: 1,
      },
    ];

    const rebootOids = [
      {
        oid: sysObjectId + systemRebootAction,
        type: snmp.ObjectType.Integer,
        value: 1,
      },
    ];

    snmpSessionList[MACAddress].rw.set(ResetOids, () => {
      snmpSessionList[MACAddress].rw.set(rebootOids, () => {
        event.sender.send(`${RESPONSE_RP_RESET_TO_DEFAULT} ${MACAddress}`, {
          success: true,
          msg: 'Success.',
        });
      });
    });
  });
});

// get snmp session list
function getSNMPSessionList() {
  return snmpSessionList;
}
// get mac list that support snmp
function getSNMPMACList() {
  return Object.keys(snmpSessionList);
}
// get mac list that support snmp and in group
function getSNMPMACInGroupList(groupId) {
  let MACInGroup;
  if (groupId === 0) {
    MACInGroup = Object.keys(deviceIntegration.default.getDeviceOnlineList());
  } else {
    MACInGroup = Object.keys(
      deviceIntegration.default.getDeviceGroupList()[groupId].deviceList
    );
  }
  return getSNMPMACList().filter((MACAddress) =>
    MACInGroup.includes(MACAddress)
  );
}

function getMACInGroupList(groupId) {
  let MACInGroup = [];
  if (groupId === 0) {
    Object.entries(deviceIntegration.default.getDeviceGroupList()).forEach(
      ([id, groupData]) => {
        if (id !== 'unGrouped') {
          MACInGroup = [...MACInGroup, ...Object.keys(groupData.deviceList)];
        }
      }
    );
  } else {
    MACInGroup = Object.keys(
      deviceIntegration.default.getDeviceGroupList()[groupId].deviceList
    );
  }
  //console.log(MACInGroup);
  return MACInGroup;
}

function getChassisId(MACAddress, getChassisIdData) {
  let chassisId = '';
  try {
    const lldpLocChassisIdOid = mib.lldp.lldpLocChassisId;
    async.parallel(
      [
        (callback) => {
          getSubtree(MACAddress, lldpLocChassisIdOid, callback);
        },
      ],
      (err, results) => {
        try {
          if (!results.every((result) => result.success)) {
            getChassisIdData(null, undefined);
            return;
          }
          const lldpLocChassisId = results[0].data;
          // console.log('chesisid main');
          // console.log(lldpLocChassisId);
          let chassisId = '';
          if (lldpLocChassisId[0].value.length === 6) {
            // console.log(value);
            let bitValue = '';
            for (var x of lldpLocChassisId[0].value.values()) {
              if (x.toString(16).toUpperCase().length === 1) {
                bitValue = bitValue + '0' + x.toString(16).toUpperCase();
              } else {
                bitValue = bitValue + x.toString(16).toUpperCase();
              }
            }
            // console.log(bitValue.match(/.{1,2}/g).join('-'));
            chassisId = bitValue.match(/.{1,2}/g).join('-');
          } else {
            chassisId = Buffer.from(
              lldpLocChassisId[0].value,
              'hex'
            ).toString();
          }
          // chassisId = Buffer.from(lldpLocChassisId[0].value, 'hex').toString();
          getChassisIdData(null, {
            MACAddress,
            chassisId,
          });
        } catch (error) {
          getChassisIdData(null, undefined);
        }
      }
    );
  } catch (error) {
    getChassisIdData(null, undefined);
  }
}

function getLLDPData(MACAddress, getDeviceLinkData) {
  const lldpData = {
    [MACAddress]: {
      neighbors: [],
      conflictData: {},
      portConflict: [],
      blockedPort: [],
    },
  };
  if (!getSNMPMACList().includes(MACAddress)) {
    getDeviceLinkData(null, lldpData);
    return;
  }
  try {
    const { sysObjectId } = snmpSessionList[MACAddress];
    const lldpRemChassisIdOid = mib.lldp.lldpRemChassisId;
    const lldpRemPortIdOid = mib.lldp.lldpRemPortId;
    const erpsEnabled = sysObjectId + mib.erps.erpsEnabled;
    const erpsRsapVlan = sysObjectId + mib.erps.erpsRsapVlan;
    const erpsData = sysObjectId + mib.erps.erpsData;
    const rstpEnabled = sysObjectId + mib.rstp.rstpEnabled;
    const rstpPortInfoRole = sysObjectId + mib.rstp.rstpPortInfoRole;
    const rstpPortInfoStat = sysObjectId + mib.rstp.rstpPortInfoStat;

    async.parallel(
      [
        (callback) => {
          getSubtree(MACAddress, lldpRemChassisIdOid, callback);
        },
        (callback) => {
          getSubtree(MACAddress, lldpRemPortIdOid, callback);
        },
        (callback) => {
          getSubtree(MACAddress, erpsEnabled, callback);
        },
        (callback) => {
          getSubtree(MACAddress, erpsRsapVlan, callback);
        },
        (callback) => {
          getSubtree(MACAddress, erpsData, callback);
        },
        (callback) => {
          getSubtree(MACAddress, rstpEnabled, callback);
        },
        (callback) => {
          getSubtree(MACAddress, rstpPortInfoRole, callback);
        },
        (callback) => {
          getSubtree(MACAddress, rstpPortInfoStat, callback);
        },
      ],
      (err, results) => {
        try {
          if (!results.every((result) => result.success)) {
            //getDeviceLinkData(null, lldpData);
            //return;
          }
          // console.log('main mac -' + MACAddress);
          // console.log(results[0].data);
          //console.log(results[1].data);
          //console.log(results[2].data);
          //console.log(results[3].data);
          //console.log(results[4].data);
          //console.log(results[5].data);
          //console.log(results[6].data);
          //console.log(results[7].data);
          const lldpRemChassisId = results[0].data;
          const lldpRemPortId = results[1].data;
          const erpsEnable = results[2].data;
          const erpsVlanId = results[3].data;
          const erpsDataall = results[4].data;
          const rstpEnable = results[5].data;
          const rstpPortInfoRoleData = results[6].data;
          const rstpPortInfoStatData = results[7].data;

          const portBuffer = [];
          const portConflict = [];
          const neighbors = [];

          //console.log(lldpRemPortId);
          lldpRemPortId.forEach((element, index) => {
            let remotePortName = element.value.toString('utf8');

            // check format port-XXX
            //console.log(remotePortName);
            if (
              remotePortName.length !== 8 ||
              !remotePortName.startsWith('port')
            )
              return;
            const portName = `port${
              element.oid.replace(lldpRemPortIdOid, '').split('.')[2]
            }`;
            if (portBuffer.includes(portName)) {
              portConflict.push(portName);
              lldpData[MACAddress].conflictData[portName] = [];
            }
            portBuffer.push(portName);
            remotePortName = `port${Number(
              element.value.toString('utf8').substring(5)
            )}`;
            const { value } = lldpRemChassisId[index];
            //console.log(value);
            let remoteMACAddress = '';
            if (value.length === 6) {
              //console.log(value);
              let bitValue = '';
              for (var x of value.values()) {
                if (x.toString(16).toUpperCase().length === 1) {
                  bitValue = bitValue + '0' + x.toString(16).toUpperCase();
                } else {
                  bitValue = bitValue + x.toString(16).toUpperCase();
                }
              }
              //console.log(bitValue.match(/.{1,2}/g).join('-'));
              remoteMACAddress =
                topology.getChassisIdList()[
                  bitValue.match(/.{1,2}/g).join('-')
                ];
            } else {
              remoteMACAddress =
                topology.getChassisIdList()[
                  Buffer.from(value, 'hex').toString()
                ];
            }

            // console.log('remote mac ' + remoteMACAddress);

            if (remoteMACAddress) {
              neighbors.push({
                portName,
                remoteMACAddress,
                remotePortName,
              });
            }
          });

          neighbors.forEach((element) => {
            if (portConflict.includes(element.portName)) {
              lldpData[MACAddress].conflictData[element.portName].push(element);
            } else {
              lldpData[MACAddress].neighbors.push(element);
            }
            lldpData[MACAddress].portConflict = portConflict;
          });

          rstpEnable.forEach((element, index) => {
            if (element.value === 1) {
              //console.log("RSTP Enabled");
              rstpPortInfoStatData.forEach((element, index) => {
                if (
                  element.value === 5 &&
                  rstpPortInfoRoleData[index].value !== 1
                ) {
                  const PortName = 'port' + (index + 1).toString();
                  //console.log(PortName);
                  lldpData[MACAddress].blockedPort.push(PortName);
                }
              });
            }
          });

          erpsEnable.forEach((element, index) => {
            if (
              element.value === 1 &&
              erpsVlanId !== undefined &&
              erpsDataall !== undefined
            ) {
              erpsVlanId.forEach((element, index) => {
                const vlanId = element.value;
                //console.log(vlanId);
                //console.log(sysObjectId + mib.erps.erpsWestPortStatus + vlanId);
                erpsDataall.forEach((element, index) => {
                  if (
                    element.oid ===
                      sysObjectId + mib.erps.erpsWestPortStatus + vlanId &&
                    element.value === 2
                  ) {
                    erpsDataall.forEach((element, index) => {
                      if (
                        element.oid ===
                        sysObjectId + mib.erps.erpsWestPort + vlanId
                      ) {
                        let PortName = 'port' + element.value.toString('utf8');
                        lldpData[MACAddress].blockedPort.push(PortName);
                      }
                    });
                  }
                  // Check Eastport
                  if (
                    element.oid ===
                      sysObjectId + mib.erps.erpsEastPortStatus + vlanId &&
                    element.value === 2
                  ) {
                    erpsDataall.forEach((element, index) => {
                      if (
                        element.oid ===
                        sysObjectId + mib.erps.erpsEastPort + vlanId
                      ) {
                        let PortName = 'port' + element.value.toString('utf8');
                        lldpData[MACAddress].blockedPort.push(PortName);
                      }
                    });
                  }
                });
              });
            }
          });
          //console.log('lldpData', lldpData);
          getDeviceLinkData(null, lldpData);
        } catch (error) {
          getDeviceLinkData(null, lldpData);
        }
      }
    );
  } catch (error) {
    getDeviceLinkData(null, lldpData);
  }
}

// get current port and power status in MIB by MAC
function getPortPowerMIBData(MACAddress, getData) {
  try {
    const { sysObjectId } = snmpSessionList[MACAddress];
    //console.log(sysObjectId);
    const ifIndexOid = mib.public.interfaces.ifIndex; // get port name
    const ifDescrOid = mib.public.interfaces.ifDescr; // get port name
    const ifOperStatusOid = mib.public.interfaces.ifOperStatus;

    const { powerInfoNumber, powerInfoStatus } =
      mib.private.systemInfo.powerInfo;

    const powerNumberOid = sysObjectId + powerInfoNumber; // get power number
    const powerStatusOid = sysObjectId + powerInfoStatus; // get power status ok(1), fault(2)

    async.parallel(
      [
        (callback) => {
          getSubtree(MACAddress, ifIndexOid, callback);
        },
        (callback) => {
          getSubtree(MACAddress, ifDescrOid, callback);
        },
        (callback) => {
          getSubtree(MACAddress, ifOperStatusOid, callback);
        },
        (callback) => {
          getSubtree(MACAddress, powerNumberOid, callback);
        },
        (callback) => {
          getSubtree(MACAddress, powerStatusOid, callback);
        },
      ],
      (err, results) => {
        try {
          const ifIndex = results[0].data;
          const ifDescr = results[1].data;
          const ifOperStatus = results[2].data;
          const powerNumber = results[3].data;
          const powerStatus = results[4].data;
          let portInfo;
          let powerInfo;
          //console.log(ifIndex);
          if (ifIndex) {
            ifIndex.forEach((element, key) => {
              //console.log(ifIndex[key].value);
              if (ifIndex[key].value <= 28) {
                const portName = ifDescr[key].value.toString('utf8');
                portInfo = {
                  ...portInfo,
                  [portName]: ifOperStatus[key].value,
                };
              }
            });

            powerNumber.forEach((element, key) => {
              const powerName = `Power${powerNumber[key].value}`;
              powerInfo = {
                ...powerInfo,
                [powerName]: powerStatus[key].value,
              };
            });
          }
          // console.log({ portInfo, powerInfo });
          getData({
            portInfo,
            powerInfo,
          });
        } catch (error) {
          console.log(error);
          return {};
        }
      }
    );
  } catch (error) {
    console.log(error);
    return {};
  }
}

ipcMain.on(REQUEST_MP_GET_ALARM_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_GET_ALARM_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found data',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress] === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].ro === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }

    const alarmInfo = {
      powerInfo: {},
      portInfo: {},
    };

    const result = alarmManagement.default.getDeviceAlarm(arg.MACAddress);
    if (result.success) {
      let portInfo = {};
      let powerInfo = {};
      result.data.forEach((element) => {
        if (element.type === 'port') {
          portInfo = {
            ...portInfo,
            [element.name]: {
              portName: element.name,
              linkUp: element.status.charAt(0) === '1',
              linkDown: element.status.charAt(1) === '1',
            },
          };
        } else if (element.type === 'power') {
          powerInfo = {
            ...powerInfo,
            [element.name]: {
              powerName: element.name,
              on: element.status.charAt(0) === '1',
              off: element.status.charAt(1) === '1',
            },
          };
        }
      });
      event.sender.send(eventName, {
        success: true,
        msg: 'Get alarm settings successful',
        data: JSON.stringify({
          portInfo,
          powerInfo,
        }),
      });
    }

    const { sysObjectId } = snmpSessionList[arg.MACAddress];
    const { powerInfoNumber } = mib.private.systemInfo.powerInfo;

    const ifIndexOid = mib.public.interfaces.ifIndex; // get port name
    const ifDescrOid = mib.public.interfaces.ifDescr; // get port name
    const powerNumberOid = sysObjectId + powerInfoNumber; // get power number

    async.parallel(
      [
        (callback) => {
          getSubtree(arg.MACAddress, ifIndexOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifDescrOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, powerNumberOid, callback);
        },
      ],
      (err, results) => {
        try {
          const ifIndex = results[0].data;
          const ifDescr = results[1].data;
          const powerNumber = results[2].data;

          for (let i = 0; i < ifIndex.length; i += 1) {
            if (ifIndex[i].value <= 28) {
              const portName = ifDescr[i].value.toString('utf8');
              alarmInfo.portInfo[portName] = {
                portName,
                linkUp: false,
                linkDown: false,
              };
            }
          }
          for (let i = 0; i < powerNumber.length; i += 1) {
            const powerName = `Power${powerNumber[i].value}`;
            alarmInfo.powerInfo[powerName] = {
              powerName,
              on: false,
              off: false,
            };
          }

          event.sender.send(eventName, {
            success: true,
            msg: 'Get alarm settings successful',
            data: JSON.stringify(alarmInfo),
          });
        } catch (error) {
          console.error(error);
          event.sender.send(eventName, {
            success: false,
            msg: 'Error in - get alarm settings fail',
          });
        }
      }
    );
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get alarm settings error',
    });
  }
});
/* */
let offlineSnmpSessionList = {};
// offline get sysObjectId
function offlineCheck(MACAddress, callback) {
  try {
    if (snmpSessionList[MACAddress] === undefined) {
      callback({
        success: true,
        msg: 'Not found',
      });
      return;
    }
    if (snmpSessionList[MACAddress].ro === undefined) {
      // delete snmpSessionList[MACAddress];
      callback({
        success: true,
        msg: 'Not found',
      });
      return;
    }
    const { sysObjectId } = mib.public.system;
    const oids = [sysObjectId];

    snmpSessionList[MACAddress].ro.get(oids, (error, varbinds) => {
      try {
        if (error) {
          if (offlineSnmpSessionList[MACAddress] === undefined) {
            offlineSnmpSessionList[MACAddress] = {};
            callback({
              success: false,
              msg: 'get sysObject error',
            });
            // delete snmpSessionList[MACAddress];
            return;
          } else {
            callback({
              success: true,
              msg: 'get sysObject error',
            });
            // delete snmpSessionList[MACAddress];
            return;
          }
        }
        if (snmp.isVarbindError(varbinds[0])) {
          // delete snmpSessionList[MACAddress];
          callback({
            success: false,
            msg: 'get sysObject error',
          });
          return;
        }
        getModelInfoOffline(MACAddress, false);
        delete offlineSnmpSessionList[MACAddress];
        callback({
          success: true,
          msg: 'get sysObject',
        });
      } catch (err) {
        console.log(err);
        callback({
          success: false,
          msg: 'get sysObject error',
        });
      }
    });
  } catch (error) {
    console.error(error);
    callback({
      success: false,
      msg: 'get sysObject error',
    });
  }
}

// get SNMP sysObjectId
function getSysObjectId(host, isPolling, resolve) {
  try {
    //discoveryLog.default.logDiscovery('enter in to getSysObjectId ');
    const deviceCommunity =
      deviceCommunityManagement.default.getDeviceCommunity(host);
    const tmpSnmpOptions = _.cloneDeep(snmpOptions);
    let snmpSession;

    if (!deviceCommunity.success) {
      snmpSession = snmp.createSession(
        host,
        snmpCommunitySetting.readCommunity,
        tmpSnmpOptions
      );
    } else {
      tmpSnmpOptions.version =
        deviceCommunity.data.snmpVer === 'v1' ? snmp.Version1 : snmp.Version2c;
      snmpSession = snmp.createSession(
        host,
        deviceCommunity.data.readCommunity,
        tmpSnmpOptions
      );
    }

    // listening error handle
    snmpSession.on('error', (err) => {
      console.log(`SNMP session error: ${err.toString()} line: 805`);
    });

    const { sysObjectId, sysDescr, sysContact, sysName, sysLocation } =
      mib.public.system;
    const { ifAlias } = mib.public.ifMIB;
    const oids = [
      sysObjectId,
      sysDescr,
      sysContact,
      sysName,
      sysLocation,
      ifAlias,
    ];
    snmpSession.get(oids, (error, varbinds) => {
      try {
        if (error) {
          snmpSession.close();
          // discoveryLog.default.logDiscovery('getSysObjectId resolve 1');
          resolve();
          return;
        }
        const isVarbindsErrorArray = [];
        varbinds.forEach((element) => {
          isVarbindsErrorArray.push(snmp.isVarbindError(element));
        });
        const modelInfo = {
          host,
          sysObjectId: isVarbindsErrorArray[0] ? '' : varbinds[0].value,
          sysDescr: isVarbindsErrorArray[1]
            ? ''
            : varbinds[1].value.toString('utf8').search(/CGS2520/) > 0
            ? 'Cisco CGS2520'
            : varbinds[1].value.toString('utf8'),
          sysContact: isVarbindsErrorArray[2]
            ? ''
            : varbinds[2].value.toString('utf8'),
          sysName: isVarbindsErrorArray[3]
            ? ''
            : varbinds[3].value.toString('utf8'),
          sysLocation: isVarbindsErrorArray[4]
            ? ''
            : varbinds[4].value.toString('utf8'),
          ifAlias: isVarbindsErrorArray[5] ? '' : varbinds[5].value,
        };
        //console.log(modelInfo);
        if (isPolling) {
          pollingOpenSnmpList.push(modelInfo);
        } else {
          scanOpenSnmpList.push(modelInfo);
        }
        snmpSession.close();
        //discoveryLog.default.logDiscovery('getSysObjectId resolve 2');
        resolve();
      } catch (err) {
        console.log(err);
        // discoveryLog.default.logDiscovery('getSysObjectId resolve 3');
        resolve();
      }
    });
  } catch (error) {
    console.error(error);
    //discoveryLog.default.logDiscovery('getSysObjectId resolve 4');
    resolve();
  }
}

// get SNMP MAC address
function getMACAddress(data, isPolling, resolve) {
  try {
    if (data === undefined) {
      resolve();
      return;
    }
    const deviceCommunity =
      deviceCommunityManagement.default.getDeviceCommunity(data.host);
    const tmpSnmpOptions = _.cloneDeep(snmpOptions);
    let snmpSession;

    if (!deviceCommunity.success) {
      snmpSession = snmp.createSession(
        data.host,
        snmpCommunitySetting.readCommunity,
        tmpSnmpOptions
      );
    } else {
      tmpSnmpOptions.version =
        deviceCommunity.data.snmpVer === 'v1' ? snmp.Version1 : snmp.Version2c;
      snmpSession = snmp.createSession(
        data.host,
        deviceCommunity.data.readCommunity,
        tmpSnmpOptions
      );
    }

    // listening error handle
    snmpSession.on('error', (err) => {
      console.log(`SNMP session error: ${err.toString()} line 906`);
    });

    const oid = mib.public.interfaces.ifPhysAddress;

    snmpSession.subtree(
      oid,
      40,
      (varbinds) => {
        try {
          let MACAddress = '00:00:00:00:00:00';
          for (let i = 0; i < varbinds.length; i += 1) {
            if (snmp.isVarbindError(varbinds[i])) {
              console.error(snmp.varbindError(varbinds[i]));
              resolve();
              return;
            }
            if (Buffer.isBuffer(varbinds[i].value)) {
              const tmpMACAddress = varbinds[i].value
                .toString('hex')
                .match(/.{1,2}/g)
                .join(':')
                .toUpperCase();

              if (tmpMACAddress !== '00:00:00:00:00:00') {
                MACAddress = tmpMACAddress;
                break;
              }
            }
          }
          if (MACAddress === '00:00:00:00:00:00') {
            resolve();
            return;
          }
          if (isPolling && snmpSessionList[MACAddress] !== undefined) {
            snmpSessionList[MACAddress].sysObjectId = data.sysObjectId;
            snmpSessionList[MACAddress].sysDescr = data.sysDescr;
            snmpSessionList[MACAddress].sysContact = data.sysContact;
            snmpSessionList[MACAddress].sysLocation = data.sysLocation;
            snmpSessionList[MACAddress].sysName = data.sysName;
            snmpSessionList[MACAddress].IPAddress = data.host;
            snmpSessionList[MACAddress].ifAlias = data.ifAlias;
          } else {
            snmpSessionList[MACAddress] = {
              sysObjectId: data.sysObjectId,
              sysDescr: data.sysDescr,
              sysName: data.sysName,
              sysContact: data.sysContact,
              sysLocation: data.sysLocation,
              IPAddress: data.host,
              ifAlias: data.ifAlias,
              ro: deviceCommunity.success
                ? snmp.createSession(
                    data.host,
                    deviceCommunity.data.readCommunity,
                    tmpSnmpOptions
                  )
                : snmp.createSession(
                    data.host,
                    snmpCommunitySetting.readCommunity,
                    tmpSnmpOptions
                  ),
              rw: deviceCommunity.success
                ? snmp.createSession(
                    data.host,
                    deviceCommunity.data.writeCommunity,
                    tmpSnmpOptions
                  )
                : snmp.createSession(
                    data.host,
                    snmpCommunitySetting.writeCommunity,
                    tmpSnmpOptions
                  ),
            };

            // listening error handle
            snmpSessionList[MACAddress].ro.on('error', (err) => {
              console.log(`SNMP session error: ${err.toString()} line: 983`);
            });
            snmpSessionList[MACAddress].rw.on('error', (err) => {
              console.log(`SNMP session error: ${err.toString()} line: 986`);
            });
          }
          resolve();
        } catch (err) {
          console.log(err);
          resolve();
        }
      },
      (error) => {
        if (error) {
          console.log(error);
        }
        resolve();
      }
    );
  } catch (error) {
    console.error(error);
    resolve();
  }
}

function getMACAddressByIP(host, isPolling, resolve) {
  try {
    if (host === undefined) {
      resolve();
      return;
    }
    const deviceCommunity =
      deviceCommunityManagement.default.getDeviceCommunity(host);
    const tmpSnmpOptions = _.cloneDeep(snmpOptions);
    let snmpSession;

    if (!deviceCommunity.success) {
      snmpSession = snmp.createSession(
        host,
        snmpCommunitySetting.readCommunity,
        tmpSnmpOptions
      );
    } else {
      tmpSnmpOptions.version =
        deviceCommunity.data.snmpVer === 'v1' ? snmp.Version1 : snmp.Version2c;
      snmpSession = snmp.createSession(
        host,
        deviceCommunity.data.readCommunity,
        tmpSnmpOptions
      );
    }

    // listening error handle
    snmpSession.on('error', (err) => {
      console.log(`SNMP session error: ${err.toString()} line: 1038`);
    });

    const oid = mib.public.interfaces.ifPhysAddress;

    snmpSession.subtree(
      oid,
      40,
      (varbinds) => {
        try {
          let MACAddress = '00:00:00:00:00:00';
          for (let i = 0; i < varbinds.length; i += 1) {
            if (snmp.isVarbindError(varbinds[i])) {
              console.error(snmp.varbindError(varbinds[i]));
              resolve('00:00:00:00:00:00');
              return;
            }
            if (Buffer.isBuffer(varbinds[i].value)) {
              const tmpMACAddress = varbinds[i].value
                .toString('hex')
                .match(/.{1,2}/g)
                .join(':')
                .toUpperCase();

              if (tmpMACAddress !== '00:00:00:00:00:00') {
                MACAddress = tmpMACAddress;
                tmperoryMAC.push({
                  host: host,
                  MacAddress: tmpMACAddress,
                });
                break;
              }
            }
          }
          if (MACAddress === '00:00:00:00:00:00') {
            resolve(MACAddress);
            return;
          }
          resolve(MACAddress);
        } catch (err) {
          console.log(err);
          resolve('00:00:00:00:00:00');
        }
      },
      (error) => {
        if (error) {
          console.log(error);
        }
        resolve('00:00:00:00:00:00');
      }
    );
  } catch (error) {
    console.error(error);
    resolve('00:00:00:00:00:00');
  }
}

//get erps information

// get atop information
function getModelInfo(MACAddress, isPolling, resolve) {
  try {
    if (snmpSessionList[MACAddress] === undefined) {
      resolve();
      return;
    }
    const { sysObjectId } = snmpSessionList[MACAddress];
    let isGroup = false;
    const deviceGroupList = deviceIntegration.default.getDeviceGroupList();
    Object.keys(deviceGroupList).every((groupId) => {
      if (
        groupId !== 'unGrouped' &&
        deviceGroupList[groupId].deviceList[MACAddress] !== undefined
      ) {
        isGroup = true;
        return false;
      }
      return true;
    });

    // console.log('[[getModelInfo]] snmpSessionList', snmpSessionList);
    updateSNMPIPAddress(MACAddress);
    const modelInfo = {};
    // not atop device
    if (!mib.supportOid.includes(sysObjectId)) {
      //console.log('[[getModelInfo]] modelInfo', modelInfo);
      modelInfo.model = snmpSessionList[MACAddress].sysDescr;
      modelInfo.IPAddress = snmpSessionList[MACAddress].IPAddress;
      modelInfo.MACAddress = MACAddress;
      modelInfo.netmask = '';
      modelInfo.gateway = '';
      modelInfo.hostname = snmpSessionList[MACAddress].sysName;
      modelInfo.kernel = 'NA';
      modelInfo.ap = 'NA';
      modelInfo.isDHCP = false;

      // change the priority,if isGroup
      if (isGroup) {
        queueManagement.default.add(onlinePacketQueue, {
          level: 0,
          isGroup,
          isPolling,
          modelInfo,
        });
      } else {
        queueManagement.default.add(onlinePacketQueue, {
          isGroup,
          isPolling,
          modelInfo,
        });
      }
      resolve();
    } else {
      const { systemFwVer, systemKernelVer, systemModel } =
        mib.private.systemInfo;
      const {
        ipConfigurationSubMask,
        ipConfigurationGateway,
        ipConfigurationDHCPStatus,
      } = mib.private.basicSetting.ipConfiguration;

      const oids = [
        sysObjectId + systemModel,
        sysObjectId + systemFwVer,
        sysObjectId + systemKernelVer,
        sysObjectId + ipConfigurationSubMask,
        sysObjectId + ipConfigurationGateway,
        sysObjectId + ipConfigurationDHCPStatus,
      ];

      snmpSessionList[MACAddress].ro.get(oids, (error, varbinds) => {
        try {
          if (error) {
            resolve();
            return;
          }
          let isVarbindsError = false;
          varbinds.forEach((element) => {
            if (snmp.isVarbindError(element)) {
              if (element.oid !== sysObjectId + systemModel) {
                isVarbindsError = true;
              }
            }
          });
          if (isVarbindsError) {
            resolve();
            return;
          }

          snmpSessionList[MACAddress].sysDescr =
            varbinds[0].value === null
              ? snmpSessionList[MACAddress].sysDescr
              : varbinds[0].value.toString('utf8');
          modelInfo.model = snmpSessionList[MACAddress].sysDescr;
          modelInfo.IPAddress = snmpSessionList[MACAddress].IPAddress;
          modelInfo.MACAddress = MACAddress;
          modelInfo.netmask = varbinds[3].value.toString('utf8');
          modelInfo.gateway = varbinds[4].value.toString('utf8');
          modelInfo.hostname = snmpSessionList[MACAddress].sysName;
          modelInfo.kernel = varbinds[2].value.toString('utf8');
          modelInfo.ap = varbinds[1].value.toString('utf8');
          modelInfo.isDHCP = varbinds[5].value === 1;

          // change the priority,if isGroup
          if (isGroup) {
            queueManagement.default.add(onlinePacketQueue, {
              level: 0,
              isGroup,
              isPolling,
              modelInfo,
            });
          } else {
            queueManagement.default.add(onlinePacketQueue, {
              isGroup,
              isPolling,
              modelInfo,
            });
          }
          resolve();
        } catch (err) {
          console.log(err);
          resolve();
        }
      });
    }
  } catch (error) {
    console.error(error);
    resolve();
  }
}

function checkStageDone(requests, scanStatus, isPolling, callback) {
  Promise.all(requests)
    .then(() => {
      // API results in the results array here
      // processing can continue using the results of all three API requests
      // console.log(`${scanStatus} all done`);
      if (!isPolling) {
        queueManagement.default.add(progressStatusQueue, {
          scanStatus,
        });
      } else {
        console.log(`SNMP check status: ${scanStatus}`);
      }
      callback();
      return null;
    })
    .catch((error) => {
      console.error(error);
      callback();
      return null;
    });
}

// initialization the list,and kill all work queue.
function initialize(data) {
  try {
    // clear all list.
    //await pollingReset();
    discoveryLog.default.logDiscovery('Enter into Initialize function!');
    scanResIPList.length = 0;
    scanOpenSnmpList.length = 0;
    snmpSessionList = {};

    // kill all queue.
    onlinePacketQueue.kill();

    // check SNMP is enable
    if (!data.isEnable) {
      data.callback();
      return;
    }

    // load mib
    mib = mibs.default.getMib();

    // load snmp default settings
    snmpOptions.timeout = data.SNMPTimeout;
    snmpOptions.version =
      data.version === 'v1' ? snmp.Version1 : snmp.Version2c;
    snmpCommunitySetting.readCommunity = data.readCommunity;
    snmpCommunitySetting.writeCommunity = data.writeCommunity;

    async.series(
      {
        scanIP: (callback) => {
          // get IP range settings
          const ipRangeData = ipRangeManagement.default.getIPRangeSettings();
          if (!ipRangeData.success) {
            callback();
            return;
          }
          // create search IP list
          // const isIpFixed = snmpManagement.default.getIsFixedIp().data
          //   .isIpFixed;
          let tmpHosts = [];
          Object.keys(ipRangeData.data).forEach((id) => {
            if (ipRangeData.data[id].isActive) {
              const result = getIPRange(
                ipRangeData.data[id].startIP,
                ipRangeData.data[id].endIP
              );
              const hosts = result;
              hosts.forEach((host) => {
                if (!tmpHosts.includes(host)) {
                  tmpHosts.push(host);
                }
              });
            }
          });

          const requests = tmpHosts.map(
            (host) =>
              new Promise((resolve) => {
                const pingTimeout = setTimeout(() => {
                  // console.log('Error in - SNMP ping');
                  resolve();
                }, options.timeout + 5000);
                ping.sys.probe(host, function (isAlive) {
                  clearTimeout(pingTimeout);
                  if (isAlive) {
                    scanResIPList.push(host);
                  }
                  resolve();
                });
              })
          );
          checkStageDone(requests, 'i', false, callback);
        },
        scanOid: (callback) => {
          const requests = scanResIPList.map(
            (host) =>
              new Promise((resolve) => getSysObjectId(host, false, resolve))
          );
          checkStageDone(requests, 's', false, callback);
        },
        scanMACAddress: (callback) => {
          const requests = scanOpenSnmpList.map(
            (host) =>
              new Promise((resolve) => getMACAddress(host, false, resolve))
          );
          checkStageDone(requests, 's', false, callback);
        },
        scanInfo: (callback) => {
          const requests = Object.keys(snmpSessionList).map(
            (MACAddress) =>
              new Promise((resolve) => getModelInfo(MACAddress, false, resolve))
          );
          checkStageDone(requests, 'a', false, callback);
        },
      },
      () => {
        // results is now equal to: {one: 1, two: 2}
        // console.log('all done');
        data.callback();
      }
    );
  } catch (error) {
    console.error(error);
    data.callback();
  }
}

function getSubtree(MACAddress, oid, callback) {
  try {
    let hasVarbinds = false;

    snmpSessionList[MACAddress].ro.subtree(
      oid,
      40,
      (varbinds) => {
        try {
          // Error handle
          let hasError = false;
          for (let i = 0; i < varbinds.length; i += 1) {
            if (snmp.isVarbindError(varbinds[i])) {
              console.error(snmp.varbindError(varbinds[i]));
              hasError = true;
            }
          }
          if (hasError) {
            callback(null, {
              success: false,
            });
          } else {
            hasVarbinds = true;
            callback(null, {
              success: true,
              data: varbinds,
            });
          }
        } catch (err) {
          console.log(err);
          callback(null, {
            success: false,
          });
        }
      },
      (error) => {
        try {
          if (error) {
            console.log(error);
            callback(null, {
              success: false,
            });
          } else if (!hasVarbinds) {
            callback(null, {
              success: false,
            });
          }
        } catch (err) {
          console.log(err);
          callback(null, {
            success: false,
          });
        }
      }
    );
  } catch (error) {
    console.error(error);
    callback(null, {
      success: false,
    });
  }
}

// update current session IP
function updateSessionIP(MACAddress, IPAddress, callback) {
  try {
    if (snmpSessionList[MACAddress] !== undefined) {
      snmpSessionList[MACAddress].ro.target = IPAddress;
      snmpSessionList[MACAddress].rw.target = IPAddress;
      snmpSessionList[MACAddress].IPAddress = IPAddress;
      getModelInfo(MACAddress, true, callback);
      return;
    }
    callback();
  } catch (error) {
    console.error(error);
    callback();
  }
}

// update current session community
function updateSessionCommunity(
  MACAddress,
  version,
  readCommunity,
  writeCommunity
) {
  try {
    if (snmpSessionList[MACAddress] !== undefined) {
      snmpSessionList[MACAddress].ro.version =
        version === 'v1' ? snmp.Version1 : snmp.Version2c;
      snmpSessionList[MACAddress].ro.community = readCommunity;
      snmpSessionList[MACAddress].rw.version =
        version === 'v1' ? snmp.Version1 : snmp.Version2c;
      snmpSessionList[MACAddress].rw.community = writeCommunity;
    }
  } catch (error) {
    console.error(error);
  }
}

function pollingStart() {
  snmpPollingTask();
}

function pollingReset() {
  try {
    if (pollingTaskParams.timeout !== undefined) {
      clearTimeout(pollingTaskParams.timeout);
      pollingTaskParams.callback();
    } else {
      console.log('not work');
    }
  } catch (err) {
    console.log(err);
  }
}

// send online packet to deviceGroupList
const onlinePacketQueue = async.queue((tmp, callback) => {
  try {
    deviceIntegration.default.updateDeviceGroupList({
      cmd: 'onlineDevice',
      isGroup: tmp.isGroup,
      isPolling: tmp.isPolling,
      device: tmp.modelInfo,
      deviceType: 'snmp',
    });
    callback();
  } catch (error) {
    console.error(error);
    callback();
  }
}, 1);

// send progress status for UI
const progressStatusQueue = async.queue((tmp, callback) => {
  try {
    windowManagement.default.send('mainId', SEND_RP_SNMP_SCAN_STATUS, {
      scanStatus: tmp.scanStatus,
    });
    setTimeout(() => {
      callback();
    }, 100);
  } catch (error) {
    callback();
  }
}, 1);

function initialDiscovery(data) {
  try {
    // clear all list.
    //discoveryLog.default.logDiscovery('Enter into initialDiscovery function!');
    pollingResIPList.length = 0;
    pollingOpenSnmpList.length = 0;
    //console.log('initial discovery data',data);

    // check SNMP is enable
    if (!data.isEnable) {
      data.callback();
      return;
    }

    // load mib
    mib = mibs.default.getMib();

    // load snmp default settings
    snmpOptions.timeout = data.SNMPTimeout;
    snmpOptions.version =
      data.version === 'v1' ? snmp.Version1 : snmp.Version2c;
    snmpCommunitySetting.readCommunity = data.readCommunity;
    snmpCommunitySetting.writeCommunity = data.writeCommunity;

    async.series(
      {
        scanIP: (callback) => {
          // get IP range settings
          const ipRangeData = ipRangeManagement.default.getIPRangeSettings();
          if (!ipRangeData.success) {
            callback();
            return;
          }
          // create search IP list
          const tmpHosts = [];
          Object.keys(ipRangeData.data).forEach((id) => {
            if (ipRangeData.data[id].isActive) {
              const result = getIPRange(
                ipRangeData.data[id].startIP,
                ipRangeData.data[id].endIP
              );
              // console.log('result 1');
              // console.log(result.value);
              const hosts = result;
              hosts.forEach((host) => {
                if (!tmpHosts.includes(host)) {
                  tmpHosts.push(host);
                }
              });
            }
          });

          const groupedHosts = [];
          const deviceGroupList =
            deviceIntegration.default.getDeviceGroupList();
          // console.log('initial discovery group list', deviceGroupList);
          Object.keys(deviceGroupList).forEach((groupId) => {
            if (groupId !== 'unGrouped') {
              Object.keys(deviceGroupList[groupId].deviceList).forEach(
                (MACAddress) => {
                  const { IPAddress } =
                    deviceGroupList[groupId].deviceList[MACAddress];
                  if (
                    tmpHosts.includes(IPAddress) &&
                    !groupedHosts.includes(IPAddress)
                  ) {
                    groupedHosts.push(IPAddress);
                  }
                }
              );
            }
          });
          const requests = groupedHosts.map(
            (host) =>
              new Promise((resolve) => {
                const pingTimeout = setTimeout(() => {
                  // console.log('Error in - SNMP ping');
                  resolve();
                }, 5000);
                ping.sys.probe(host, function (isAlive) {
                  clearTimeout(pingTimeout);
                  if (isAlive) {
                    pollingResIPList.push(host);
                  }
                  if (!isAlive) console.log('ping error');
                  resolve();
                });
              })
          );
          checkStageDone(requests, 'i', true, callback);
        },
        scanOid: (callback) => {
          const requests = pollingResIPList.map(
            (host) =>
              new Promise((resolve) => getSysObjectId(host, true, resolve))
          );
          checkStageDone(requests, 's', true, callback);
        },
        scanMACAddress: (callback) => {
          const requests = pollingOpenSnmpList.map(
            (host) =>
              new Promise((resolve) => getMACAddress(host, true, resolve))
          );
          checkStageDone(requests, 's', true, callback);
        },
        scanInfo: (callback) => {
          const requests = Object.keys(snmpSessionList).map(
            (MACAddress) =>
              new Promise((resolve) => getModelInfo(MACAddress, true, resolve))
          );
          checkStageDone(requests, 'a', true, callback);
        },
      },
      () => {
        // results is now equal to: {one: 1, two: 2}
        data.callback();
      }
    );
  } catch (error) {
    console.log(error);
    data.callback();
  }
}

function snmpPollingTask() {
  return async.forever(
    (next) => {
      // clear all list.
      discoveryLog.default.logDiscovery('Enter into snmpPollingTask function!');
      pollingResIPList.length = 0;
      pollingOpenSnmpList.length = 0;
      pollingTaskParams = {
        timeout: undefined,
        callback: undefined,
      };

      // reload SNMP settings
      const snmpSettings = snmpManagement.default.getSnmpSettings();
      if (!snmpSettings.success) {
        pollingTaskParams.timeout = setTimeout(() => {
          next();
        }, snmpPollInterval * 1000 * 60);
        pollingTaskParams.callback = next;
        return;
      }
      snmpPollInterval = snmpSettings.data.SNMPPollInterval;

      // check SNMP is enable
      if (!snmpSettings.data.isEnable) {
        pollingTaskParams.timeout = setTimeout(() => {
          next();
        }, snmpPollInterval * 1000 * 60);
        pollingTaskParams.callback = next;
      } else {
        // load mib
        mib = mibs.default.getMib();

        // load snmp default settings
        snmpOptions.timeout = snmpSettings.data.SNMPTimeout;
        snmpOptions.version =
          snmpSettings.data.version === 'v1' ? snmp.Version1 : snmp.Version2c;
        snmpCommunitySetting.readCommunity = snmpSettings.data.readCommunity;
        snmpCommunitySetting.writeCommunity = snmpSettings.data.writeCommunity;

        async.series(
          {
            scanIP: (callback) => {
              // get IP range settings
              discoveryLog.default.logDiscovery(
                'Enter into snmpPollingTask function scanIP!'
              );
              const ipRangeData =
                ipRangeManagement.default.getIPRangeSettings();
              if (!ipRangeData.success) {
                callback();
                return;
              }
              // create search IP list
              const tmpHosts = [];
              Object.keys(ipRangeData.data).forEach((id) => {
                if (ipRangeData.data[id].isActive) {
                  const result = getIPRange(
                    ipRangeData.data[id].startIP,
                    ipRangeData.data[id].endIP
                  );
                  // console.log('result 2');
                  // console.log(result);
                  const hosts = result;
                  hosts.forEach((host) => {
                    if (!tmpHosts.includes(host)) {
                      tmpHosts.push(host);
                    }
                  });
                }
              });

              // async for ping IP
              const requests = tmpHosts.map(
                (host) =>
                  new Promise((resolve) => {
                    const pingTimeout = setTimeout(() => {
                      // console.log('Error in - SNMP ping');
                      resolve();
                    }, 5000);
                    ping.sys.probe(host, function (isAlive) {
                      clearTimeout(pingTimeout);
                      if (isAlive) {
                        pollingResIPList.push(host);
                      }
                      resolve();
                    });
                  })
              );
              checkStageDone(requests, 'i', true, callback);
              discoveryLog.default.logDiscovery(
                'Exit from snmpPollingTask function scanIP!'
              );
            },

            scanOid: (callback) => {
              discoveryLog.default.logDiscovery(
                'Enter into snmpPollingTask function scanOid!'
              );
              const requests = pollingResIPList.map(
                (host) =>
                  new Promise((resolve) => getSysObjectId(host, true, resolve))
              );
              checkStageDone(requests, 's', true, callback);
              discoveryLog.default.logDiscovery(
                'Exit from snmpPollingTask function scanOid!'
              );
            },
            scanMACAddress: (callback) => {
              discoveryLog.default.logDiscovery(
                'Enter into snmpPollingTask function scanMACAddress!'
              );
              const requests = pollingOpenSnmpList.map(
                (host) =>
                  new Promise((resolve) => getMACAddress(host, true, resolve))
              );
              checkStageDone(requests, 's', true, callback);
              discoveryLog.default.logDiscovery(
                'Exit from snmpPollingTask function scanMACAddress!'
              );
            },
            scanInfo: (callback) => {
              discoveryLog.default.logDiscovery(
                'Enter into snmpPollingTask function scanInfo!'
              );
              const requests = Object.keys(snmpSessionList).map(
                (MACAddress) =>
                  new Promise((resolve) =>
                    getModelInfo(MACAddress, true, resolve)
                  )
              );
              checkStageDone(requests, 'a', true, callback);
              discoveryLog.default.logDiscovery(
                'Exit from snmpPollingTask function scanInfo!'
              );
            },
          },
          () => {
            // reload SNMP settings
            const currentSnmpSettings =
              snmpManagement.default.getSnmpSettings();
            if (currentSnmpSettings.success) {
              snmpPollInterval = currentSnmpSettings.data.SNMPPollInterval;
            }
            pollingTaskParams.timeout = setTimeout(() => {
              next();
            }, snmpPollInterval * 1000 * 60);
            pollingTaskParams.callback = next;
          }
        );
      }
    },
    (error) => {
      // if next is called with a value in its first parameter, it will appear
      // in here as 'err', and execution will stop.
      if (error) {
        discoveryLog.default.logDiscovery('Error in snmp polling!');
        console.error('offline detection forever error');
      }
    }
  );
}

// SNMP get/set channel
ipcMain.on(REQUEST_MP_GET_PORT_INFORMATION, (event, arg) => {
  const eventName = RESPONSE_RP_GET_PORT_INFORMATION;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found data',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress] === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].ro === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }

    const portInfo = {};
    const { sysObjectId } = snmpSessionList[arg.MACAddress];
    const { portStatusPortMode } = mib.private.portConfiguration.portControl;

    const sysUpTimeOid = mib.public.system.sysUpTime;
    const ifIndexOid = mib.public.interfaces.ifIndex; // get port name
    const ifDescrOid = mib.public.interfaces.ifDescr; // get port name
    const ifAdminStatusOid = mib.public.interfaces.ifAdminStatus; // set/get port enable/disable
    const ifOperStatusOid = mib.public.interfaces.ifOperStatus; // get port status
    const ifHighSpeedOid = mib.public.interfaces.ifHighSpeed; // get port speed
    const portModeOid = sysObjectId + portStatusPortMode; // get port mode
    const ifHCInOctetsOid = mib.public.interfaces.ifHCInOctets;
    const ifInErrorsOid = mib.public.interfaces.ifInErrors;
    const ifHCInUcastPktsOid = mib.public.interfaces.ifHCInUcastPkts;
    const ifHCInMulticastPktsOid = mib.public.interfaces.ifHCInMulticastPkts;
    const ifHCInBroadcastPktsOid = mib.public.interfaces.ifHCInBroadcastPkts;
    const ifHCOutOctetsOid = mib.public.interfaces.ifHCOutOctets;
    const ifOutErrorsOid = mib.public.interfaces.ifOutErrors;
    const ifHCOutUcastPktsOid = mib.public.interfaces.ifHCOutUcastPkts;
    const ifHCOutMulticastPktsOid = mib.public.interfaces.ifHCOutMulticastPkts;
    const ifHCOutBroadcastPktsOid = mib.public.interfaces.ifHCOutBroadcastPkts;

    async.parallel(
      [
        (callback) => {
          getSubtree(arg.MACAddress, ifIndexOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifDescrOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifAdminStatusOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifOperStatusOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHighSpeedOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, portModeOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHCInOctetsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifInErrorsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHCInUcastPktsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHCInMulticastPktsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHCInBroadcastPktsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHCOutOctetsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifOutErrorsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHCOutUcastPktsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHCOutMulticastPktsOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifHCOutBroadcastPktsOid, callback);
        },
        (callback) => {
          snmpSessionList[arg.MACAddress].ro.get(
            [sysUpTimeOid],
            (error, varbinds) => {
              if (error) {
                callback(null, {
                  success: false,
                });
              } else if (snmp.isVarbindError(varbinds[0])) {
                callback(null, {
                  success: false,
                });
              } else {
                callback(null, {
                  success: true,
                  data: varbinds[0],
                });
              }
            }
          );
        },
      ],
      (err, results) => {
        try {
          const ifIndex = results[0].data;
          const ifDescr = results[1].data;
          const ifAdminStatus = results[2].data;
          const ifOperStatus = results[3].data;
          const ifHighSpeed = results[4].data;
          const portMode = results[5].data;
          const ifHCInOctets = results[6].data;
          const ifInErrors = results[7].data;
          const ifHCInUcastPkts = results[8].data;
          const ifHCInMulticastPkts = results[9].data;
          const ifHCInBroadcastPkts = results[10].data;
          const ifHCOutOctets = results[11].data;
          const ifOutErrors = results[12].data;
          const ifHCOutUcastPkts = results[13].data;
          const ifHCOutMulticastPkts = results[14].data;
          const ifHCOutBroadcastPkts = results[15].data;
          const upTime = results[16].data;
          //console.log(ifHighSpeed);
          for (let i = 0; i < ifIndex.length; i += 1) {
            if (ifIndex[i].value <= 28) {
              const portName = ifDescr[i].value.toString('utf8');
              portInfo[portName] = {
                enableStatus: ifAdminStatus[i].value,
                portStatus: ifOperStatus[i].value === 1 ? 'up' : 'down',
                speed: ifHighSpeed !== undefined ? ifHighSpeed[i].value : 0,
                portMode:
                  portMode !== undefined
                    ? portMode[i].value.toString('utf8')
                    : 'NA',
                inOctets: ifHCInOctets[i].value,
                inErrors: ifInErrors[i].value,
                inUcastPkts: ifHCInUcastPkts[i].value,
                inMulticastPkts: ifHCInMulticastPkts[i].value,
                inBroadcastPkts: ifHCInBroadcastPkts[i].value,
                outOctets: ifHCOutOctets[i].value,
                outErrors: ifOutErrors[i].value,
                outUcastPkts: ifHCOutUcastPkts[i].value,
                outMulticastPkts: ifHCOutMulticastPkts[i].value,
                outBroadcastPkts: ifHCOutBroadcastPkts[i].value,
              };
            }
          }
          event.sender.send(eventName, {
            success: true,
            msg: 'Get port information successful',
            data: JSON.stringify({
              upTime: upTime.value,
              portInfo,
            }),
          });
        } catch (error) {
          console.error(error);
          event.sender.send(eventName, {
            success: false,
            msg: 'Error in - get port information fail',
          });
        }
      }
    );
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get port information error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_PORT_LINK_STATUS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_PORT_LINK_STATUS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found data',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    if (arg.portName === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found portName',
      });
      return;
    }
    if (arg.linkStatus === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found linkStatus',
      });
      return;
    }
    if (arg.linkStatus < 1 || arg.linkStatus > 2) {
      event.sender.send(eventName, {
        success: false,
        msg: 'LinkStatus range error',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].ro === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].rw === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }

    const ifDescrOid = mib.public.interfaces.ifDescr;
    const ifAdminStatusOid = mib.public.interfaces.ifAdminStatus;

    async.parallel(
      [
        (callback) => {
          getSubtree(arg.MACAddress, ifDescrOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, ifAdminStatusOid, callback);
        },
      ],
      (err, results) => {
        try {
          if (!results[0].success || !results[1].success) {
            event.sender.send(eventName, {
              success: false,
              msg: 'Error in - set port link status varbind error',
            });
            return;
          }
          const ifDescr = results[0].data;
          const ifAdminStatus = results[1].data;
          let setOid = '';
          for (let i = 0; i < ifDescr.length; i += 1) {
            const portName = ifDescr[i].value.toString('utf8');
            if (portName === arg.portName) {
              const { oid } = ifAdminStatus[i];
              setOid = oid;
              break;
            }
          }

          const setVarbinds = [
            {
              oid: setOid,
              type: snmp.ObjectType.Integer,
              value: arg.linkStatus,
            },
          ];

          snmpSessionList[arg.MACAddress].rw.set(
            setVarbinds,
            (error, varbinds) => {
              if (error) {
                console.error(error.toString());
                event.sender.send(eventName, {
                  success: false,
                  msg: 'Error in - set port link status fail',
                });
              } else {
                if (snmp.isVarbindError(varbinds[0])) {
                  console.error(snmp.varbindError(varbinds[0]));
                  event.sender.send(eventName, {
                    success: false,
                    msg: 'Error in - set port link status varbind error',
                  });
                  return;
                }
                const setInfo = {
                  portName: arg.portName,
                  linkStatus: varbinds[0].value,
                };
                event.sender.send(eventName, {
                  success: true,
                  msg: 'Set port link status successful',
                  data: setInfo,
                });
              }
            }
          );
        } catch (error) {
          console.error(error);
          event.sender.send(eventName, {
            success: false,
            msg: 'Error in - set port link status fail',
          });
        }
      }
    );
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set port link status error',
    });
  }
});

function updateSNMPIPAddress(macaddress) {
  if (macaddress === undefined) {
    console.log('[[updateNMPIPAddress]] mac address undefined');
    return;
  }
  if (snmpSessionList[macaddress] === undefined) {
    console.log(
      `[[updateNMPIPAddress]] snmpSessionList[${macaddress}] undefined`
    );
    return;
  }

  const { sysObjectId } = snmpSessionList[macaddress];
  // not atop device
  if (!mib.supportOid.includes(sysObjectId)) {
    // console.log(
    //   `[[updateNMPIPAddress]] device not supported systemid ${sysObjectId}`,
    // );
    //console.log(snmpSessionList[macaddress]);
    return;
  }

  const { ipConfigurationAddress } = mib.private.basicSetting.ipConfiguration;
  const oids = [sysObjectId + ipConfigurationAddress];
  snmpSessionList[macaddress].ro.get(oids, (error, varbinds) => {
    if (error) {
      console.log(`[[updateNMPIPAddress]] snmp get error `, error);

      return;
    }
    let isVarbindsError = false;
    varbinds.forEach((element) => {
      if (snmp.isVarbindError(element)) {
        isVarbindsError = true;
      }
    });
    if (isVarbindsError) {
      console.log(`[[updateNMPIPAddress]] snmp get error inVarbinds `);
      return;
    }
    const ipaddress = varbinds[0].value.toString('utf8');

    snmpSessionList[macaddress].IPAddress = ipaddress;
  });
}

ipcMain.on(REQUEST_MP_GET_SNMP_DEVICE_NETWORK_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_GET_SNMP_DEVICE_NETWORK_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found data',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress] === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].ro === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }

    const { sysObjectId } = snmpSessionList[arg.MACAddress];
    // not atop device
    if (!mib.supportOid.includes(sysObjectId)) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Device not supported',
      });
      return;
    }

    const {
      ipConfigurationDHCPStatus,
      ipConfigurationAddress,
      ipConfigurationSubMask,
      ipConfigurationGateway,
      ipConfigurationDNS1,
      ipConfigurationDNS2,
    } = mib.private.basicSetting.ipConfiguration;
    const { sysName } = mib.public.system;

    const oids = [
      sysObjectId + ipConfigurationDHCPStatus,
      sysObjectId + ipConfigurationAddress,
      sysObjectId + ipConfigurationSubMask,
      sysObjectId + ipConfigurationGateway,
      sysObjectId + ipConfigurationDNS1,
      sysObjectId + ipConfigurationDNS2,
      sysName,
    ];

    snmpSessionList[arg.MACAddress].ro.get(oids, (error, varbinds) => {
      if (error) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - get SNMP network settings fail',
        });
        return;
      }
      let isVarbindsError = false;
      varbinds.forEach((element) => {
        if (snmp.isVarbindError(element)) {
          isVarbindsError = true;
        }
      });
      if (isVarbindsError) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - get SNMP network settings varbind error',
        });
        return;
      }

      const networkInfo = {
        isDHCP: varbinds[0].value === 1,
        IPAddress: varbinds[1].value.toString('utf8'),
        netmask: varbinds[2].value.toString('utf8'),
        gateway: varbinds[3].value.toString('utf8'),
        dns1: varbinds[4].value.toString('utf8'),
        dns2: varbinds[5].value.toString('utf8'),
        hostname: varbinds[6].value.toString('utf8'),
      };

      event.sender.send(eventName, {
        success: true,
        msg: 'Get SNMP network settings successful',
        data: networkInfo,
      });
    });
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - SNMP network settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_SNMP_DEVICE_NETWORK_SETTINGS, (event, arg) => {
  console.log(arg);
  const eventName = `${RESPONSE_RP_SET_SNMP_DEVICE_NETWORK_SETTINGS} ${arg.MACAddress}`;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found data',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
        data: {
          MACAddress: arg.MACAddress,
        },
      });
      return;
    }
    if (arg.isDHCP === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found isDHCP',
        data: {
          MACAddress: arg.MACAddress,
        },
      });
      return;
    }
    if (arg.hostname === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found hostname',
        data: {
          MACAddress: arg.MACAddress,
        },
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress] === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
        data: {
          MACAddress: arg.MACAddress,
        },
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].rw === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
        data: {
          MACAddress: arg.MACAddress,
        },
      });
      return;
    }
    if (typeof arg.isDHCP !== 'boolean') {
      event.sender.send(eventName, {
        success: false,
        msg: 'isDHCP not bool',
        data: {
          MACAddress: arg.MACAddress,
        },
      });
      return;
    }
    const { sysObjectId } = snmpSessionList[arg.MACAddress];
    // not atop device
    if (!mib.supportOid.includes(sysObjectId)) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Device not supported',
      });
      return;
    }
    const {
      ipConfigurationDHCPStatus,
      ipConfigurationAddress,
      ipConfigurationSubMask,
      ipConfigurationGateway,
      ipConfigurationDNS1,
      ipConfigurationDNS2,
    } = mib.private.basicSetting.ipConfiguration;
    const { sysName } = mib.public.system;

    // DHCP enable
    if (arg.isDHCP) {
      const oids = [
        {
          oid: sysObjectId + ipConfigurationDHCPStatus,
          type: snmp.ObjectType.Integer,
          value: 1,
        },
        {
          oid: sysName,
          type: snmp.ObjectType.OctetString,
          value: arg.hostname,
        },
      ];

      snmpSessionList[arg.MACAddress].rw.set(oids, (error, varbinds) => {
        if (error) {
          console.log(error);
          event.sender.send(eventName, {
            success: false,
            msg: 'Error in - set SNMP network settings fail',
            data: {
              MACAddress: arg.MACAddress,
            },
          });
          return;
        }
        let isVarbindsError = false;
        varbinds.forEach((element) => {
          if (snmp.isVarbindError(element)) {
            isVarbindsError = true;
          }
        });
        if (isVarbindsError) {
          event.sender.send(eventName, {
            success: false,
            msg: 'Error in - set SNMP network settings varbind error',
            data: {
              MACAddress: arg.MACAddress,
            },
          });
          return;
        }

        const networkInfo = {
          isDHCP: varbinds[0].value === 1,
          hostname: varbinds[1].value.toString('utf8'),
          MACAddress: arg.MACAddress,
        };

        event.sender.send(eventName, {
          success: true,
          msg: 'Set SNMP network settings successful',
          data: networkInfo,
        });
      });
    } else {
      if (arg.IPAddress === undefined) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Not found IPAddress',
          data: {
            MACAddress: arg.MACAddress,
          },
        });
        return;
      }
      if (arg.netmask === undefined) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Not found netmask',
          data: {
            MACAddress: arg.MACAddress,
          },
        });
        return;
      }
      if (arg.gateway === undefined) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Not found gateway',
          data: {
            MACAddress: arg.MACAddress,
          },
        });
        return;
      }
      if (arg.dns1 === undefined) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Not found dns1',
          data: {
            MACAddress: arg.MACAddress,
          },
        });
        return;
      }
      if (arg.dns2 === undefined) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Not found dns2',
          data: {
            MACAddress: arg.MACAddress,
          },
        });
        return;
      }
      const oids = [
        {
          oid: sysObjectId + ipConfigurationDHCPStatus,
          type: snmp.ObjectType.Integer,
          value: 2,
        },
        {
          oid: sysObjectId + ipConfigurationSubMask,
          type: snmp.ObjectType.IpAddress,
          value: arg.netmask,
        },
        {
          oid: sysObjectId + ipConfigurationGateway,
          type: snmp.ObjectType.IpAddress,
          value: arg.gateway,
        },
        {
          oid: sysObjectId + ipConfigurationDNS1,
          type: snmp.ObjectType.IpAddress,
          value: arg.dns1,
        },
        {
          oid: sysObjectId + ipConfigurationDNS2,
          type: snmp.ObjectType.IpAddress,
          value: arg.dns2,
        },
        {
          oid: sysObjectId + ipConfigurationAddress,
          type: snmp.ObjectType.IpAddress,
          value: arg.IPAddress,
        },
        {
          oid: sysName,
          type: snmp.ObjectType.OctetString,
          value: arg.hostname,
        },
      ];

      snmpSessionList[arg.MACAddress].rw.set(oids, (error, varbinds) => {
        if (error) {
          console.log(error);
          event.sender.send(eventName, {
            success: false,
            msg: 'Error in - set SNMP network settings fail',
            data: {
              MACAddress: arg.MACAddress,
            },
          });
          return;
        }

        let isVarbindsError = false;
        varbinds.forEach((element) => {
          if (snmp.isVarbindError(element)) {
            isVarbindsError = true;
          }
        });
        if (isVarbindsError) {
          event.sender.send(eventName, {
            success: false,
            msg: 'Error in - set SNMP network settings varbind error',
            data: {
              MACAddress: arg.MACAddress,
            },
          });
          return;
        }

        const networkInfo = {
          isDHCP: varbinds[0].value === 1,
          netmask: varbinds[1].value.toString('utf8'),
          gateway: varbinds[2].value.toString('utf8'),
          dns1: varbinds[3].value.toString('utf8'),
          dns2: varbinds[4].value.toString('utf8'),
          IPAddress: varbinds[5].value.toString('utf8'),
          hostname: varbinds[6].value.toString('utf8'),
          MACAddress: arg.MACAddress,
        };

        event.sender.send(eventName, {
          success: true,
          msg: 'Set SNMP network settings successful',
          data: networkInfo,
        });
        updateSessionIP(arg.MACAddress, networkInfo.IPAddress, () => {
          console.log('change success');
        });
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - SNMP network settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_GET_POWER_STATUS, (event, arg) => {
  const eventName = RESPONSE_RP_GET_POWER_STATUS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found data',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress] === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].ro === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }

    const powerStatus = {};
    const { sysObjectId } = snmpSessionList[arg.MACAddress];

    // not atop device
    if (!mib.supportOid.includes(sysObjectId)) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Get power status successful',
        data: 'NA',
      });
      return;
    }

    const { powerInfoNumber, powerInfoStatus } =
      mib.private.systemInfo.powerInfo;

    const powerNumberOid = sysObjectId + powerInfoNumber; // get power number
    const powerStatusOid = sysObjectId + powerInfoStatus; // get power status ok(1), fault(2)

    async.parallel(
      [
        (callback) => {
          getSubtree(arg.MACAddress, powerNumberOid, callback);
        },
        (callback) => {
          getSubtree(arg.MACAddress, powerStatusOid, callback);
        },
      ],
      (err, results) => {
        try {
          let isAllSuccess = true;
          results.forEach((element) => {
            if (!element.success) {
              isAllSuccess = false;
            }
          });

          if (!isAllSuccess) {
            event.sender.send(eventName, {
              success: false,
              msg: 'Error in - get power status varbind error',
            });
            return;
          }

          const powerNumber = results[0].data;
          const powerInfo = results[1].data;

          for (let i = 0; i < powerNumber.length; i += 1) {
            const powerName = `Power${powerNumber[i].value}`;

            powerStatus[powerName] = powerInfo[i].value;
          }
          event.sender.send(eventName, {
            success: true,
            msg: 'Get power status successful',
            data: powerStatus,
          });
        } catch (error) {
          console.error(error);
          event.sender.send(eventName, {
            success: false,
            msg: 'Error in - get power status fail',
          });
        }
      }
    );
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get power status error',
    });
  }
});

ipcMain.on(REQUEST_MP_LET_SNMP_DEVICE_REBOOT, (event, arg) => {
  const eventName = RESPONSE_RP_LET_SNMP_DEVICE_REBOOT;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found data',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress] === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].rw === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    const { sysObjectId } = snmpSessionList[arg.MACAddress];

    // not atop device
    if (!mib.supportOid.includes(sysObjectId)) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Device not supported',
      });
      return;
    }

    const { systemRebootAction } = mib.private.basicSetting.systemReboot;

    const oids = [
      {
        oid: sysObjectId + systemRebootAction,
        type: snmp.ObjectType.Integer,
        value: 1,
      },
    ];

    snmpSessionList[arg.MACAddress].rw.set(oids, (error, varbinds) => {
      console.log(error);
      console.log(varbinds);
      if (error) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - let SNMP device reboot fail',
        });
        return;
      }
      if (snmp.isVarbindError(varbinds[0])) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - let SNMP device reboot varbind error',
        });
        return;
      }

      event.sender.send(eventName, {
        success: true,
        msg: 'Let SNMP device reboot successful',
      });
    });
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - let SNMP device reboot error',
    });
  }
});

ipcMain.on(REQUEST_MP_LET_SNMP_DEVICE_BEEP, (event, arg) => {
  const eventName = RESPONSE_RP_LET_SNMP_DEVICE_BEEP;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found data',
      });
      return;
    }
    if (arg.MACAddress === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found MACAddress',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress] === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    if (snmpSessionList[arg.MACAddress].rw === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found this session',
      });
      return;
    }
    const { sysObjectId } = snmpSessionList[arg.MACAddress];
    // not atop device
    if (!mib.supportOid.includes(sysObjectId)) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Device not supported',
      });
      return;
    }

    const { locateBeep } = mib.private.diagnosis.locate;

    const oids = [
      {
        oid: sysObjectId + locateBeep,
        type: snmp.ObjectType.Integer,
        value: 1,
      },
    ];

    snmpSessionList[arg.MACAddress].rw.set(oids, (error, varbinds) => {
      if (error) {
        console.log(error);
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - let SNMP device beep fail',
        });
        return;
      }
      if (snmp.isVarbindError(varbinds[0])) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - let SNMP device beep varbind error',
        });
        return;
      }

      event.sender.send(eventName, {
        success: true,
        msg: 'Let SNMP device beep successful',
      });
    });
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - let SNMP device beep error',
    });
  }
});

ipcMain.on(REQUEST_MP_GET_DEVICE_PROPERTIES, (event, arg) => {
  const { MACAddress } = arg;

  let sysObjectId = '';
  let sysDescr = '';
  let sysName = '';
  let sysContact = '';
  let sysLocation = '';
  let ifAlias = '';
  if (snmpSessionList[MACAddress] !== undefined) {
    ({ sysObjectId, sysDescr, sysName, sysContact, sysLocation, ifAlias } =
      snmpSessionList[MACAddress]);
  }
  //console.log(snmpSessionList);
  event.sender.send(RESPONSE_RP_GET_DEVICE_PROPERTIES, {
    success: true,
    data: {
      sysObjectId,
      sysDescr,
      sysName,
      sysContact,
      sysLocation,
      ifAlias,
    },
  });
});

export default {
  checkSNMPPolling,
  getSNMPSessionList,
  initialize,
  offlineCheck,
  updateSessionCommunity,
  pollingStart,
  pollingReset,
  initialDiscovery,
  getPortPowerMIBData,
  getSNMPMACList,
  getSNMPMACInGroupList,
  getLLDPData,
  getChassisId,
  getMACInGroupList,
  getModelInfoOffline,
};

function getModelInfoOffline(MACAddress, isPolling) {
  try {
    if (snmpSessionList[MACAddress] === undefined) {
      return;
    }
    const { sysObjectId } = snmpSessionList[MACAddress];
    let isGroup = false;
    const deviceGroupList = deviceIntegration.default.getDeviceGroupList();
    Object.keys(deviceGroupList).every((groupId) => {
      if (
        groupId !== 'unGrouped' &&
        deviceGroupList[groupId].deviceList[MACAddress] !== undefined
      ) {
        isGroup = true;
        return false;
      }
      return true;
    });

    // console.log('[[getModelInfo]] snmpSessionList', snmpSessionList);
    updateSNMPIPAddress(MACAddress);
    const modelInfo = {};
    // not atop device
    if (!mib.supportOid.includes(sysObjectId)) {
      //console.log('[[getModelInfo]] modelInfo', modelInfo);
      modelInfo.model = snmpSessionList[MACAddress].sysDescr;
      modelInfo.IPAddress = snmpSessionList[MACAddress].IPAddress;
      modelInfo.MACAddress = MACAddress;
      modelInfo.netmask = '';
      modelInfo.gateway = '';
      modelInfo.hostname = snmpSessionList[MACAddress].sysName;
      modelInfo.kernel = 'NA';
      modelInfo.ap = 'NA';
      modelInfo.isDHCP = false;

      // change the priority,if isGroup
      if (isGroup) {
        queueManagement.default.add(onlinePacketQueue, {
          level: 0,
          isGroup,
          isPolling,
          modelInfo,
        });
      } else {
        queueManagement.default.add(onlinePacketQueue, {
          isGroup,
          isPolling,
          modelInfo,
        });
      }
    } else {
      const { systemFwVer, systemKernelVer, systemModel } =
        mib.private.systemInfo;
      const {
        ipConfigurationSubMask,
        ipConfigurationGateway,
        ipConfigurationDHCPStatus,
      } = mib.private.basicSetting.ipConfiguration;

      const oids = [
        sysObjectId + systemModel,
        sysObjectId + systemFwVer,
        sysObjectId + systemKernelVer,
        sysObjectId + ipConfigurationSubMask,
        sysObjectId + ipConfigurationGateway,
        sysObjectId + ipConfigurationDHCPStatus,
      ];

      snmpSessionList[MACAddress].ro.get(oids, (error, varbinds) => {
        try {
          if (error) {
            return;
          }
          let isVarbindsError = false;
          varbinds.forEach((element) => {
            if (snmp.isVarbindError(element)) {
              if (element.oid !== sysObjectId + systemModel) {
                isVarbindsError = true;
              }
            }
          });
          if (isVarbindsError) {
            return;
          }

          snmpSessionList[MACAddress].sysDescr =
            varbinds[0].value === null
              ? snmpSessionList[MACAddress].sysDescr
              : varbinds[0].value.toString('utf8');
          modelInfo.model = snmpSessionList[MACAddress].sysDescr;
          modelInfo.IPAddress = snmpSessionList[MACAddress].IPAddress;
          modelInfo.MACAddress = MACAddress;
          modelInfo.netmask = varbinds[3].value.toString('utf8');
          modelInfo.gateway = varbinds[4].value.toString('utf8');
          modelInfo.hostname = snmpSessionList[MACAddress].sysName;
          modelInfo.kernel = varbinds[2].value.toString('utf8');
          modelInfo.ap = varbinds[1].value.toString('utf8');
          modelInfo.isDHCP = varbinds[5].value === 1;

          // change the priority,if isGroup
          if (isGroup) {
            queueManagement.default.add(onlinePacketQueue, {
              level: 0,
              isGroup,
              isPolling,
              modelInfo,
            });
          } else {
            queueManagement.default.add(onlinePacketQueue, {
              isGroup,
              isPolling,
              modelInfo,
            });
          }
        } catch (err) {
          console.log(err);
        }
      });
    }
  } catch (error) {
    console.error(error);
  }
}
