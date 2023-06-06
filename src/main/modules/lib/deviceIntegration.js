/* main device list management */
import { ipcMain } from 'electron';
import async from 'async';
import _ from 'lodash';
import {
  gwd,
  windowManagement,
  groupManagement,
  iniReader,
  offlineDetection,
  mailManagement,
  snmpManagement,
  queueManagement,
  snmp,
  ciscoCheckPortUpDown,
  eventLogManagement,
  notificationManagement,
  progressManagement,
  nodeCron,
  telegram,
  telegramManagement,
} from '..';
import startTopologyPolling from './topology';
// import startAnyFaultPolling from './anyFault';
import {
  REQUEST_MP_DISCOVERY_ALL_DEVICES,
  RESPONSE_RP_DISCOVERY_ALL_DEVICES,
  SEND_RP_ALL_DEVICES_LIST,
} from '../../utils/IPCEvents';

const tmpOnlineStatus = {};

let deviceGroupList = {}; // main device lists
let tmpDeviceList = {};
let isDiscovery = false;
let isReload = true;

// initialization the list,and kill all work queue.
function initializeList() {
  // try {
  //console.log('-----ini------');
  isDiscovery = false;

  // kill all queue.
  deviceGroupListQueue.kill();
  deviceGroupListSendQueue.kill();
  groupManagement.default.killQueue();

  // clear deviceGroupList and tmpOnlineStatus.
  Object.keys(deviceGroupList).forEach(prop => {
    delete deviceGroupList[prop];
  });
  Object.keys(tmpOnlineStatus).forEach(prop => {
    delete deviceGroupList[prop];
  });

  // merge group data
  const groupData = groupManagement.default.getGroupData();
  if (!groupData.success) {
    // error msg
  } else {
    //console.log(groupData.data);
    deviceGroupList = _.cloneDeep(groupData.data);
    Object.keys(deviceGroupList).forEach(groupId => {
      Object.keys(deviceGroupList[groupId].deviceList).forEach(MACAddress => {
        deviceGroupList[groupId].deviceList[MACAddress].online = false;
        deviceGroupList[groupId].deviceList[MACAddress].isDHCP = false;
        deviceGroupList[groupId].deviceList[MACAddress].deviceType = 'unknown';
      });
    });

    if (deviceGroupList.unGrouped === undefined) {
      deviceGroupList.unGrouped = { groupName: 'unGrouped', deviceList: {} };
    }
  }

  async.series(
    {
      discovery: next => {
        // send deviceGroupList to UI
        //console.log('-----ini------');
        queueManagement.default.add(deviceGroupListSendQueue, {});
        // 【gwd】send boradcast to invite
        gwd.default.initialize();

        // run snmp
        const snmpSettings = snmpManagement.default.getSnmpSettings();
        //console.log(snmpSettings);
        if (!snmpSettings.success) {
          next();
          return;
        }

        snmpSettings.data.callback = next;
        snmp.default.initialDiscovery(snmpSettings.data);
      },
    },
    () => {
      if (isReload) {
        // start polling
        //snmp.default.checkSNMPPolling();
        //snmp.default.pollingStart();
        offlineDetection.default.start();
        nodeCron.default.start();
        telegram.default.getInfo();
        ciscoCheckPortUpDown.default.start();
        // startAnyFaultPolling();
        startTopologyPolling();
        isReload = false;
      }
    },
  );
  // } catch (error) {
  //   console.error(error);
  // }
}

// other module send new data to update
function updateDeviceGroupList(data) {
  queueManagement.default.add(deviceGroupListQueue, data);
}

function getGroupsByMACAddress(MACAddress) {
  const groups = [];
  Object.entries(deviceGroupList).forEach(([groupId, data]) => {
    if (data.deviceList[MACAddress] !== undefined) {
      groups.push(groupId);
    }
  });
  return groups;
}

// for groupmanagement to get deviceGroupList
function getDeviceGroupList() {
  return _.cloneDeep(deviceGroupList);
}

function gwdOnlineStatus(MACAddress, resolve) {
  const config = iniReader.default.getConfig();

  tmpDeviceList[MACAddress].callback = resolve;
  tmpDeviceList[MACAddress].timeout = setTimeout(() => {
    queueManagement.default.add(gwdDeviceOnlineQueue, {
      MACAddress,
      online: false,
    });
  }, config.systemInit.checkOfflineTime);
}

function gwdDeviceOnlineMessage(data) {
  try {
    queueManagement.default.add(gwdDeviceOnlineQueue, data);
  } catch (error) {
    console.error(error);
  }
}

// for offlineDetection to get the online model of grouping
function getDeviceOnlineList() {
  try {
    const deviceOnlineList = {};

    Object.keys(deviceGroupList).forEach(groupId => {
      if (groupId !== 'unGrouped') {
        Object.keys(deviceGroupList[groupId].deviceList).forEach(MACAddress => {
          if (
            groupId !== 'unGrouped' &&
            deviceOnlineList[MACAddress] === undefined
          ) {
            deviceOnlineList[MACAddress] = {
              model: deviceGroupList[groupId].deviceList[MACAddress].model,
              IPAddress:
                deviceGroupList[groupId].deviceList[MACAddress].IPAddress,
              MACAddress:
                deviceGroupList[groupId].deviceList[MACAddress].MACAddress,
              deviceType:
                deviceGroupList[groupId].deviceList[MACAddress].deviceType,
              online: deviceGroupList[groupId].deviceList[MACAddress].online,
            };
          }
        });
      }
    });

    return deviceOnlineList;
  } catch (error) {
    console.error(error);
  }
}

function getSuportSNMPOnlineMACList() {
  try {
    const onlineDeviceList = getDeviceOnlineList();
    //console.log(onlineDeviceList);
    let supportSNMPOnlineMACList = [];
    Object.values(onlineDeviceList).forEach(element => {
      //console.log(element.deviceType);
      if (element.deviceType !== 'gwd') {
        supportSNMPOnlineMACList = [
          ...supportSNMPOnlineMACList,
          element.MACAddress,
        ];
      }
    });
    //console.log(supportSNMPOnlineMACList);
    return supportSNMPOnlineMACList;
  } catch (error) {
    console.log(error);
  }
}

export default {
  initializeList,
  updateDeviceGroupList,
  getDeviceGroupList,
  getDeviceOnlineList,
  gwdDeviceOnlineMessage,
  getSuportSNMPOnlineMACList,
  getGroupsByMACAddress,
};

// gwd device online queue
const gwdDeviceOnlineQueue = async.queue((tmp, callback) => {
  try {
    if (tmpDeviceList[tmp.MACAddress] === undefined) {
      callback();
      return;
    }
    if (tmpDeviceList[tmp.MACAddress].online !== undefined) {
      callback();
      return;
    }
    if (tmp.online) {
      clearTimeout(tmpDeviceList[tmp.MACAddress].timeout);
      tmpDeviceList[tmp.MACAddress].callback();
      tmpDeviceList[tmp.MACAddress].online = true;
    } else {
      tmpDeviceList[tmp.MACAddress].online = false;
      tmpDeviceList[tmp.MACAddress].callback();
    }
    callback();
  } catch (error) {
    console.error(error);
    callback();
  }
}, 1);

// deviceGroupList send queue
const deviceGroupListSendQueue = async.queue((tmp, callback) => {
  try {
    setTimeout(() => {
      Object.keys(deviceGroupList).forEach(groupId => {
        if (groupId !== 'unGrouped') {
          Object.keys(deviceGroupList[groupId].deviceList).forEach(
            MACAddress => {
              deviceGroupList[groupId].deviceList[MACAddress].isAUZ = true;
            },
          );
        } else {
          Object.keys(deviceGroupList.unGrouped.deviceList).forEach(
            MACAddress => {
              deviceGroupList.unGrouped.deviceList[MACAddress].isAUZ = false;
            },
          );
        }
      });
      const deviceGroupListCopy = _.cloneDeep(deviceGroupList);

      delete deviceGroupListCopy.unGrouped;
      if (isDiscovery) {
        deviceGroupListCopy.unGrouped = _.cloneDeep(deviceGroupList.unGrouped);
      }
      windowManagement.default.send(
        'mainId',
        SEND_RP_ALL_DEVICES_LIST,
        JSON.stringify(deviceGroupListCopy),
      );
      callback();
    }, 150);
  } catch (error) {
    callback();
  }
}, 1);

// device list queue task
const deviceGroupListQueue = async.queue((temp, callback) => {
  const tmp = temp;
  let isGroup = false;
  let deviceGroupListCopy = {};
  try {
    switch (tmp.cmd) {
      case 'onlineDevice': {
        if (discoveryQueue.length() !== 0 && tmp.deviceType === 'snmp') {
          if (tmp.isPolling) {
            break;
          }
        }
        const { deviceType } = tmp;
        let dt = deviceType;
        if (tmp.isGroup) {
          // update new model info
          Object.keys(deviceGroupList).forEach(groupId => {
            if (
              groupId !== 'unGrouped' &&
              deviceGroupList[groupId].deviceList[tmp.device.MACAddress] !==
                undefined
            ) {
              // check device type
              if (
                deviceGroupList[groupId].deviceList[tmp.device.MACAddress]
                  .deviceType === 'gwd' &&
                tmp.deviceType === 'snmp'
              ) {
                dt = 'all';
              } else if (
                deviceGroupList[groupId].deviceList[tmp.device.MACAddress]
                  .deviceType === 'snmp' &&
                tmp.deviceType === 'gwd'
              ) {
                dt = 'all';
              } else if (
                deviceGroupList[groupId].deviceList[tmp.device.MACAddress]
                  .deviceType === 'all'
              ) {
                dt = 'all';
              }

              // if device is offline
              if (
                !deviceGroupList[groupId].deviceList[tmp.device.MACAddress]
                  .online
              ) {
                if (tmpOnlineStatus[tmp.device.MACAddress] === undefined) {
                  tmpOnlineStatus[tmp.device.MACAddress] = {
                    online: true,
                  };
                }

                if (!tmpOnlineStatus[tmp.device.MACAddress].online) {
                  // save log
                  eventLogManagement.default.updateEventLog({
                    MACAddress: tmp.device.MACAddress,
                    type: 'onlineStatus',
                    msg: 'online',
                  });
                  // show notification
                  notificationManagement.default.showDeviceOnline(
                    true,
                    tmp.device,
                  );
                  //console.log(`online: ${tmp.device.MACAddress}`);
                }

                tmpOnlineStatus[tmp.device.MACAddress].online = true;
              }

              if (tmp.deviceType === 'gwd' && dt === 'all') {
                deviceGroupList[groupId].deviceList[
                  tmp.device.MACAddress
                ].deviceType = dt;
              } else {
                deviceGroupList[groupId].deviceList[tmp.device.MACAddress] = {
                  model: tmp.device.model,
                  IPAddress: tmp.device.IPAddress,
                  MACAddress: tmp.device.MACAddress,
                  netmask: tmp.device.netmask,
                  gateway: tmp.device.gateway,
                  hostname: tmp.device.hostname,
                  kernel: tmp.device.kernel,
                  ap: tmp.device.ap,
                  online: true,
                  isDHCP: tmp.device.isDHCP,
                  deviceType: dt,
                };
              }
            }
          });
        } else {
          // if deviceGroupList is not in the model, add device to UI
          if (
            deviceGroupList.unGrouped.deviceList[tmp.device.MACAddress] !==
            undefined
          ) {
            if (
              deviceGroupList.unGrouped.deviceList[tmp.device.MACAddress]
                .deviceType === 'gwd' &&
              tmp.deviceType === 'snmp'
            ) {
              dt = 'all';
            } else if (
              deviceGroupList.unGrouped.deviceList[tmp.device.MACAddress]
                .deviceType === 'snmp' &&
              tmp.deviceType === 'gwd'
            ) {
              dt = 'all';
            } else if (
              deviceGroupList.unGrouped.deviceList[tmp.device.MACAddress]
                .deviceType === 'all'
            ) {
              dt = 'all';
            }
          }
          if (tmp.deviceType === 'gwd' && dt === 'all') {
            deviceGroupList.unGrouped.deviceList[
              tmp.device.MACAddress
            ].deviceType = dt;
          } else {
            deviceGroupList.unGrouped.deviceList[tmp.device.MACAddress] = {
              model: tmp.device.model,
              IPAddress: tmp.device.IPAddress,
              MACAddress: tmp.device.MACAddress,
              netmask: tmp.device.netmask,
              gateway: tmp.device.gateway,
              hostname: tmp.device.hostname,
              kernel: tmp.device.kernel,
              ap: tmp.device.ap,
              online: true,
              isDHCP: tmp.device.isDHCP,
              deviceType: dt,
            };
          }
        }

        if (tmp.isGroup) {
          groupManagement.default.updateModelInfo(tmp);
        }

        break;
      }
      case 'offlineDevice': {
        let hasOffline = false;
        Object.keys(deviceGroupList).forEach(groupId => {
          if (groupId !== 'unGrouped') {
            if (
              deviceGroupList[groupId].deviceList[tmp.MACAddress] !== undefined
            ) {
              if (tmp.hasDisable.includes('gwd')) {
                if (
                  deviceGroupList[groupId].deviceList[tmp.MACAddress]
                    .deviceType === 'all'
                ) {
                  deviceGroupList[groupId].deviceList[
                    tmp.MACAddress
                  ].deviceType = 'snmp';
                } else if (
                  deviceGroupList[groupId].deviceList[tmp.MACAddress]
                    .deviceType === 'gwd'
                ) {
                  deviceGroupList[groupId].deviceList[
                    tmp.MACAddress
                  ].deviceType = 'unknown';
                  deviceGroupList[groupId].deviceList[
                    tmp.MACAddress
                  ].online = false;
                  hasOffline = true;
                }
              }

              if (tmp.hasDisable.includes('snmp')) {
                if (
                  deviceGroupList[groupId].deviceList[tmp.MACAddress]
                    .deviceType === 'all'
                ) {
                  deviceGroupList[groupId].deviceList[
                    tmp.MACAddress
                  ].deviceType = 'gwd';
                } else if (
                  deviceGroupList[groupId].deviceList[tmp.MACAddress]
                    .deviceType === 'snmp'
                ) {
                  deviceGroupList[groupId].deviceList[
                    tmp.MACAddress
                  ].deviceType = 'unknown';
                  deviceGroupList[groupId].deviceList[
                    tmp.MACAddress
                  ].online = false;
                  hasOffline = true;
                }
              }
            }
          }
        });

        if (hasOffline) {
          if (tmpOnlineStatus[tmp.MACAddress].online) {
            eventLogManagement.default.updateEventLog({
              MACAddress: tmp.MACAddress,
              type: 'onlineStatus',
              msg: 'offline',
            });
            // show notification
            notificationManagement.default.showDeviceOnline(false, {
              model: tmp.model,
              MACAddress: tmp.MACAddress,
              IPAddress: tmp.IPAddress,
            });
            //console.log(`offline: ${tmp.MACAddress}`);
          }
          tmpOnlineStatus[tmp.MACAddress].online = false;
        }
        break;
      }
      case 'addGroup': {
        deviceGroupList[tmp.groupId] = {
          groupName: tmp.groupName,
          deviceList: {},
        };

        tmp.event.sender.send(tmp.eventName, {
          success: true,
          msg: 'Add group successful',
          data: { cmd: tmp.cmd },
        });
        tmp.callbackfn();
        break;
      }
      case 'renameGroup': {
        deviceGroupList[tmp.groupId].groupName = tmp.groupName;

        tmp.event.sender.send(tmp.eventName, {
          success: true,
          msg: 'Rename group successful',
          data: { cmd: tmp.cmd },
        });
        tmp.callbackfn();
        break;
      }
      case 'deleteGroup': {
        deviceGroupListCopy = _.cloneDeep(deviceGroupList);
        delete deviceGroupListCopy[tmp.groupId];
        delete deviceGroupListCopy.unGrouped;

        Object.keys(deviceGroupList[tmp.groupId].deviceList).forEach(
          MACAddress => {
            isGroup = false;
            Object.keys(deviceGroupListCopy).every(key => {
              Object.keys(deviceGroupListCopy[key].deviceList).every(key2 => {
                if (
                  deviceGroupListCopy[key].deviceList[key2].MACAddress ===
                  MACAddress
                ) {
                  isGroup = true;
                  return false;
                }
                return true;
              });
              if (isGroup) {
                return false;
              }
              return true;
            });
            if (
              !isGroup &&
              deviceGroupList[tmp.groupId].deviceList[MACAddress].online
            ) {
              deviceGroupList.unGrouped.deviceList[MACAddress] = {
                model:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress].model,
                IPAddress:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress].IPAddress,
                MACAddress:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress]
                    .MACAddress,
                netmask:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress].netmask,
                gateway:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress].gateway,
                hostname:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress].hostname,
                kernel:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress].kernel,
                ap: deviceGroupList[tmp.groupId].deviceList[MACAddress].ap,
                online:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress].online,
                isDHCP:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress].isDHCP,
                deviceType:
                  deviceGroupList[tmp.groupId].deviceList[MACAddress]
                    .deviceType,
              };
            }
          },
        );

        delete deviceGroupList[tmp.groupId];

        tmp.event.sender.send(tmp.eventName, {
          success: true,
          msg: 'delete group successful',
          data: { cmd: tmp.cmd },
        });
        tmp.callbackfn();
        break;
      }
      case 'addRemoveDevice': {
        // join device to this group
        Object.keys(tmp.modifyGroupList.addDeviceList).forEach(MACAddress => {
          deviceGroupList[tmp.groupId].deviceList[MACAddress] = {
            model: tmp.modifyGroupList.addDeviceList[MACAddress].model,
            IPAddress: tmp.modifyGroupList.addDeviceList[MACAddress].IPAddress,
            MACAddress:
              tmp.modifyGroupList.addDeviceList[MACAddress].MACAddress,
            netmask: tmp.modifyGroupList.addDeviceList[MACAddress].netmask,
            gateway: tmp.modifyGroupList.addDeviceList[MACAddress].gateway,
            hostname: tmp.modifyGroupList.addDeviceList[MACAddress].hostname,
            kernel: tmp.modifyGroupList.addDeviceList[MACAddress].kernel,
            ap: tmp.modifyGroupList.addDeviceList[MACAddress].ap,
            online: tmp.modifyGroupList.addDeviceList[MACAddress].online,
            isDHCP: tmp.modifyGroupList.addDeviceList[MACAddress].isDHCP,
            deviceType:
              tmp.modifyGroupList.addDeviceList[MACAddress].deviceType,
          };
          if (deviceGroupList.unGrouped.deviceList[MACAddress] !== undefined) {
            if (tmpOnlineStatus[MACAddress] === undefined) {
              tmpOnlineStatus[MACAddress] = {
                online: true,
              };
            }
            tmpOnlineStatus[MACAddress].online = true;

            eventLogManagement.default.updateEventLog({
              MACAddress,
              type: 'onlineStatus',
              msg: 'online',
            });

            const modelInfo = {
              model: tmp.modifyGroupList.addDeviceList[MACAddress].model,
              IPAddress:
                tmp.modifyGroupList.addDeviceList[MACAddress].IPAddress,
              MACAddress:
                tmp.modifyGroupList.addDeviceList[MACAddress].MACAddress,
            };
            // show notification
            notificationManagement.default.showDeviceOnline(true, modelInfo);

            //console.log(`online: ${MACAddress}`);
            delete deviceGroupList.unGrouped.deviceList[MACAddress];
          }
        });

        // remove device from this group
        tmp.modifyGroupList.removeDeviceList.forEach(element => {
          const modelInfoCopy = _.cloneDeep(
            deviceGroupList[tmp.groupId].deviceList[element],
          );
          delete deviceGroupList[tmp.groupId].deviceList[element];

          isGroup = false;
          Object.keys(deviceGroupList).every(groupId => {
            if (
              groupId !== 'unGrouped' &&
              deviceGroupList[groupId].deviceList[element] !== undefined
            ) {
              isGroup = true;
              return false;
            }
            return true;
          });

          if (!isGroup && modelInfoCopy.online) {
            deviceGroupList.unGrouped.deviceList[element] = {
              model: modelInfoCopy.model,
              IPAddress: modelInfoCopy.IPAddress,
              MACAddress: modelInfoCopy.MACAddress,
              netmask: modelInfoCopy.netmask,
              gateway: modelInfoCopy.gateway,
              hostname: modelInfoCopy.hostname,
              kernel: modelInfoCopy.kernel,
              ap: modelInfoCopy.ap,
              online: modelInfoCopy.online,
              isDHCP: modelInfoCopy.isDHCP,
              deviceType: modelInfoCopy.deviceType,
            };
          }
        });
        // tmp.event.sender.send(tmp.eventName, {
        //   success: true,
        //   msg: 'Add/Remove device to group successful',
        //   data: { cmd: tmp.cmd },
        // });
        tmp.callbackfn();
        break;
      }
      default: {
        break;
      }
    }
    if (deviceGroupListSendQueue.length() === 0) {
      queueManagement.default.add(deviceGroupListSendQueue, {});
    }

    callback();
  } catch (error) {
    console.error(error);
    if (tmp.eventName !== undefined) {
      tmp.event.sender.send(tmp.eventName, {
        success: false,
        msg: 'Error in - set group data error',
        data: { cmd: tmp.cmd },
      });
    }
    callback();
  }
}, 1);

// device list queue task
const discoveryQueue = async.queue((temp, callback) => {
  const tmp = temp;
  try {
    isDiscovery = true;

    // kill all queue.
    deviceGroupListQueue.kill();
    deviceGroupListSendQueue.kill();
    groupManagement.default.killQueue();

    // clear deviceGroupList.
    Object.keys(deviceGroupList).forEach(prop => {
      delete deviceGroupList[prop];
    });

    // merge group data
    const groupData = groupManagement.default.getGroupData();
    if (!groupData.success) {
      // error msg
    } else {
      deviceGroupList = _.cloneDeep(groupData.data);
      Object.keys(deviceGroupList).forEach(groupId => {
        Object.keys(deviceGroupList[groupId].deviceList).forEach(MACAddress => {
          deviceGroupList[groupId].deviceList[MACAddress].online = false;
          deviceGroupList[groupId].deviceList[MACAddress].isDHCP = false;
          deviceGroupList[groupId].deviceList[MACAddress].deviceType =
            'unknown';
        });
      });

      if (deviceGroupList.unGrouped === undefined) {
        deviceGroupList.unGrouped = { groupName: 'unGrouped', deviceList: {} };
      }
    }

    // send deviceGroupList to UI
    queueManagement.default.add(deviceGroupListSendQueue, {});

    async.series(
      {
        gwdDiscovery: next => {
          tmpDeviceList = {};
          Object.keys(deviceGroupList).forEach(groupId => {
            if (groupId !== 'unGrouped') {
              Object.keys(deviceGroupList[groupId].deviceList).forEach(
                MACAddress => {
                  if (tmpDeviceList[MACAddress] === undefined) {
                    tmpDeviceList[MACAddress] = {
                      model:
                        deviceGroupList[groupId].deviceList[MACAddress].model,
                      MACAddress,
                      IPAddress:
                        deviceGroupList[groupId].deviceList[MACAddress]
                          .IPAddress,
                    };
                  }
                },
              );
            }
          });

          const requests = Object.keys(tmpDeviceList).map(
            MACAddress =>
              new Promise(resolve => gwdOnlineStatus(MACAddress, resolve)),
          );
          gwd.default.initialize();

          Promise.all(requests)
            .then(() => {
              next();
              return null;
            })
            .catch(error => {
              console.error(error);
              next();
              return null;
            });
        },
        snmpDiscovery: next => {
          // run snmp
          tmp.snmpSettings.callback = () => {
            progressManagement.default.removeProgress('SNMP', 'initialize');
            next();
          };
          progressManagement.default.addProgress('SNMP', 'initialize');
          snmp.default.initialize(tmp.snmpSettings);
        },
        checkOnlineStatus: next => {
          const config = iniReader.default.getConfig();
          setTimeout(() => {
            // get offline device
            const offlineDeviceList = {};
            Object.keys(deviceGroupList).forEach(groupId => {
              if (groupId !== 'unGrouped') {
                Object.keys(deviceGroupList[groupId].deviceList).forEach(
                  MACAddress => {
                    if (
                      !deviceGroupList[groupId].deviceList[MACAddress].online
                    ) {
                      const { model, IPAddress } = deviceGroupList[
                        groupId
                      ].deviceList[MACAddress];
                      offlineDeviceList[MACAddress] = {
                        model,
                        MACAddress,
                        IPAddress,
                      };
                    }
                  },
                );
              }
            });
            const offlineList = {};
            Object.keys(offlineDeviceList).forEach(MACAddress => {
              if (tmpOnlineStatus[MACAddress] !== undefined) {
                if (
                  !tmpDeviceList[MACAddress].online &&
                  tmpOnlineStatus[MACAddress].online
                ) {
                  offlineList[MACAddress] = {
                    model: offlineDeviceList[MACAddress].model,
                    MACAddress: offlineDeviceList[MACAddress].MACAddress,
                    IPAddress: offlineDeviceList[MACAddress].IPAddress,
                  };
                  eventLogManagement.default.updateEventLog({
                    MACAddress,
                    type: 'onlineStatus',
                    msg: 'offline',
                  });
                  // show notification
                  notificationManagement.default.showDeviceOnline(
                    false,
                    offlineDeviceList[MACAddress],
                  );
                  //console.log(`offline: ${MACAddress}`);
                }
                tmpOnlineStatus[MACAddress].online = false;
              }
            });
            if (Object.keys(offlineList).length !== 0) {
              // sending email
              mailManagement.default.sendOfflineMail({ ...offlineList });
              telegramManagement.default.sendOfflineTelegram({
                ...offlineList,
              });
            }
            next();
          }, config.systemInit.checkOfflineTime);
        },
      },
      () => {
        callback();
      },
    );
  } catch (error) {
    console.error(error);
    callback();
  }
}, 1);

// search all device
ipcMain.on(REQUEST_MP_DISCOVERY_ALL_DEVICES, event => {
  const eventName = RESPONSE_RP_DISCOVERY_ALL_DEVICES;
  try {
    if (discoveryQueue.length() === 0) {
      const snmpSettings = snmpManagement.default.getSnmpSettings();
      if (!snmpSettings.success) {
        event.sender.send(eventName, {
          success: false,
          msg: 'Error in - loading snmp settings fail',
        });
        return;
      }
      event.sender.send(eventName, {
        success: true,
        msg: 'Discovery all devices successful',
        isEnableSNMP: snmpSettings.data.isEnable,
      });

      // add discovery queue
      //console.log('initialize start');
      //initializeList(true);
      //console.log('initialize finish');
      queueManagement.default.add(discoveryQueue, {
        isReload: false,
        snmpSettings: snmpSettings.data,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Discovery all devices is running, please wait',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - discovery all devices error',
    });
  }
});
