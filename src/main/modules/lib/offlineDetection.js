/* device on/offline detection */
import { dialog } from 'electron';
import async from 'async';
import ping from 'ping';
import {
  deviceIntegration,
  gwd,
  snmp,
  mailManagement,
  queueManagement,
  advancedManagement,
  telegramManagement,
  discoveryLog,
} from '..';

const offlineDetectionParams = {
  offlinePollInterval: 30,
  offlineTimeout: 1000,
};
let deviceOnlineList = {};
let gwdDetectionList = {};
let pingDetectionList = {};
let offlineDetectionList = {};
let detectTaskParams = { timeout: undefined, callback: undefined };

function start() {
  offlineDetectionTask();
}

function refreshAdvancedSettings() {
  const result =
    advancedManagement.default.getOfflineDetectionAdvancedSettings();
  if (!result.success) {
    dialog.showErrorBox('Error!', 'loading offline Detection setting Error!');
    return;
  }

  offlineDetectionParams.offlinePollInterval =
    result.data.offlinePollInterval * 1000;
  offlineDetectionParams.offlineTimeout = result.data.offlineTimeout;
}

function gwdDeviceOnlineMessage(data) {
  try {
    queueManagement.default.add(gwdDeviceOnlineQueue, data);
  } catch (error) {
    console.error(error);
  }
}

function pingDeviceOnlineMessage(MACAddress, host, resolve) {
  pingDetectionList[MACAddress].callback = resolve;
  pingDetectionList[MACAddress].timeout = setTimeout(() => {
    ping.sys.probe(host, function (isAlive) {
      if (!isAlive) {
        queueManagement.default.add(pingDeviceOnlineQueue, {
          MACAddress,
          online: false,
        });
      } else {
        queueManagement.default.add(pingDeviceOnlineQueue, {
          MACAddress,
          online: true,
        });
      }
    });
  }, offlineDetectionParams.offlineTimeout);
}

function gwdOfflineDetection(MACAddress, resolve) {
  gwdDetectionList[MACAddress].callback = resolve;
  gwdDetectionList[MACAddress].timeout = setTimeout(() => {
    queueManagement.default.add(gwdDeviceOnlineQueue, {
      MACAddress,
      online: false,
    });
  }, offlineDetectionParams.offlineTimeout);
}

function snmpOfflineDetection(MACAddress, resolve) {
  //console.log('snmpOfflineDetection', MACAddress);
  snmp.default.offlineCheck(MACAddress, (result) => {
    try {
      // SNMP disable
      //console.log('snmpOfflineDetection result', result);
      if (!result.success) {
        if (offlineDetectionList[MACAddress] !== undefined) {
          offlineDetectionList[MACAddress].hasDisable.push('snmp');
        } else {
          offlineDetectionList[MACAddress] = {
            model: deviceOnlineList[MACAddress].model,
            IPAddress: deviceOnlineList[MACAddress].IPAddress,
            deviceType: deviceOnlineList[MACAddress].deviceType,
            hasDisable: ['snmp'],
          };
        }
      }
      resolve();
      return null;
    } catch (error) {
      console.error(error);
      resolve();
      return null;
    }
  });
}

function checkDetectionDone(requests, detectionType, callback) {
  Promise.all(requests)
    .then(() => {
      // API results in the results array here
      // processing can continue using the results of all three API requests
      // console.log(`${detectionType} detection done`);
      callback();
      return null;
    })
    .catch((error) => {
      console.error(error);
      callback();
      return null;
    });
}

function detectReset() {
  if (detectTaskParams.timeout !== undefined) {
    clearTimeout(detectTaskParams.timeout);
    detectTaskParams.callback();
  }
}

export default { start, gwdDeviceOnlineMessage, detectReset };

// gwd device online queue
const gwdDeviceOnlineQueue = async.queue((tmp, callback) => {
  try {
    if (gwdDetectionList[tmp.MACAddress] === undefined) {
      callback();
      return;
    }

    if (tmp.online) {
      clearTimeout(gwdDetectionList[tmp.MACAddress].timeout);
    } else {
      offlineDetectionList[tmp.MACAddress] = {
        model: deviceOnlineList[tmp.MACAddress].model,
        IPAddress: deviceOnlineList[tmp.MACAddress].IPAddress,
        deviceType: deviceOnlineList[tmp.MACAddress].deviceType,
        hasDisable: ['gwd'],
      };
    }
    gwdDetectionList[tmp.MACAddress].callback();
    delete gwdDetectionList[tmp.MACAddress];

    callback();
  } catch (error) {
    console.error(error);
    callback();
  }
}, 1);

const pingDeviceOnlineQueue = async.queue((tmp, callback) => {
  try {
    if (pingDetectionList[tmp.MACAddress] === undefined) {
      callback();
      return;
    }

    if (tmp.online) {
      clearTimeout(pingDetectionList[tmp.MACAddress].timeout);
    } else {
      // console.log('offlineDetectionList', offlineDetectionList);
      offlineDetectionList[tmp.MACAddress] = {
        model: deviceOnlineList[tmp.MACAddress].model,
        IPAddress: deviceOnlineList[tmp.MACAddress].IPAddress,
        deviceType: deviceOnlineList[tmp.MACAddress].deviceType,
        hasDisable: ['ping'],
      };
    }
    pingDetectionList[tmp.MACAddress].callback();
    delete pingDetectionList[tmp.MACAddress];

    callback();
  } catch (error) {
    console.error(error);
    callback();
  }
}, 1);

function offlineDetectionTask() {
  return async.forever(
    (next) => {
      // next is suitable for passing to things that need a callback(err [, whatever]);
      // it will result in this function being called again.
      // console.log('offlineDetection Start!!');
      refreshAdvancedSettings();
      deviceOnlineList = deviceIntegration.default.getDeviceOnlineList(); // get deviceOlineList
      offlineDetectionList = {};
      detectTaskParams = { timeout: undefined, callback: undefined };

      gwdDetectionList = {};
      const snmpDetectionList = [];
      pingDetectionList = {};

      //console.log('device Online List', deviceOnlineList);

      Object.keys(deviceOnlineList).forEach((MACAddress) => {
        switch (deviceOnlineList[MACAddress].deviceType) {
          case 'gwd':
            gwdDetectionList[MACAddress] = {};
            snmpDetectionList.push(MACAddress);
            break;
          case 'snmp':
            snmpDetectionList.push(MACAddress);
            break;
          default:
            if (deviceOnlineList[MACAddress].online) {
              gwdDetectionList[MACAddress] = {};
            } else {
              pingDetectionList[MACAddress] = {
                host: deviceOnlineList[MACAddress].IPAddress,
              };
            }
            snmpDetectionList.push(MACAddress);
            break;
        }
      });
      //console.log('device Online List 1', snmpDetectionList);
      if (Object.keys(deviceOnlineList).length === 0) {
        gwd.default.deviceDiscovery();

        detectTaskParams.timeout = setTimeout(() => {
          next();
        }, offlineDetectionParams.offlinePollInterval);
        detectTaskParams.callback = next;
        console.log('offline detect done.');
      } else {
        //console.log('gwdDetectionList', gwdDetectionList);
        //console.log('snmpDetectionList', snmpDetectionList);
        async.series(
          {
            gwdOffline: (callback) => {
              const requests = Object.keys(gwdDetectionList).map(
                (MACAddress) =>
                  new Promise((resolve) =>
                    gwdOfflineDetection(MACAddress, resolve)
                  )
              );
              gwd.default.deviceDiscovery();
              checkDetectionDone(requests, 'gwd', callback);
            },
            pingOffline: (callback) => {
              //console.log('pingDetectionList', pingDetectionList);
              const requests = Object.keys(pingDetectionList).map(
                (MACAddress) =>
                  new Promise((resolve) =>
                    pingDeviceOnlineMessage(
                      MACAddress,
                      pingDetectionList[MACAddress].host,
                      resolve
                    )
                  )
              );
              gwd.default.deviceDiscovery();

              checkDetectionDone(requests, 'gwd', callback);
            },
            snmpOffline: (callback) => {
              const requests = snmpDetectionList.map(
                (MACAddress) =>
                  new Promise((resolve) =>
                    snmpOfflineDetection(MACAddress, resolve)
                  )
              );
              //console.log('device Online List 2', requests);
              checkDetectionDone(requests, 'snmp', callback);
            },
          },
          () => {
            try {
              console.log('offline detect done.');

              // sending email
              const mailList = {};
              let needSendMail = false;
              // refresh UI
              Object.entries(offlineDetectionList).forEach(
                ([MACAddress, value]) => {
                  deviceIntegration.default.updateDeviceGroupList({
                    cmd: 'offlineDevice',
                    MACAddress,
                    model: offlineDetectionList[MACAddress].model,
                    IPAddress: offlineDetectionList[MACAddress].IPAddress,
                    hasDisable: offlineDetectionList[MACAddress].hasDisable,
                  });
                  //console.log('value', value);
                  if (value.deviceType === 'all') {
                    if (
                      value.hasDisable.includes('snmp') &&
                      value.hasDisable.includes('gwd')
                    ) {
                      mailList[MACAddress] = value;
                      needSendMail = true;
                    }
                  } else {
                    if (
                      value.hasDisable.includes('snmp') ||
                      value.hasDisable.includes('gwd')
                    ) {
                      mailList[MACAddress] = value;
                      needSendMail = true;
                    }
                  }
                }
              );
              if (needSendMail) {
                mailManagement.default.sendOfflineMail({ ...mailList });
                telegramManagement.default.sendOfflineTelegram({ ...mailList });
              }
              refreshAdvancedSettings();
              detectTaskParams.timeout = setTimeout(() => {
                next();
              }, offlineDetectionParams.offlinePollInterval);
              detectTaskParams.callback = next;
            } catch (error) {
              detectTaskParams.timeout = setTimeout(() => {
                next();
              }, offlineDetectionParams.offlinePollInterval);
              detectTaskParams.callback = next;
              console.error(error);
            }
          }
        );
      }
    },
    (error) => {
      // if next is called with a value in its first parameter, it will appear
      // in here as 'err', and execution will stop.
      if (error) {
        discoveryLog.default.logDiscovery('Error in offline detection');
        console.error('offline detection forever error');
      }
    }
  );
}
