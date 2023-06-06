import async from 'async';
import snmp from 'net-snmp';
import {
  groupManagement,
  deviceIntegration,
  telegramManagement,
  eventLogManagement,
} from '..';

let snmpSession;
let detectTaskParams = { timeout: undefined, callback: undefined };
let prevPortUpDetails = [];
let deviceList = {};

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

function start() {
  checkPortUpandDownTask();
}

function checkPortUpandDownTask() {
  let firstRun = true;
  return async.forever(
    next => {
      detectTaskParams = { timeout: undefined, callback: undefined };
      const { deviceListArray } = getCiscoDeviceDetails();
      //console.log('devicelist Array', deviceListArray);
      if (deviceListArray.length <= 0) {
        detectTaskParams.timeout = setTimeout(() => {
          next();
        }, 5000);
        detectTaskParams.callback = next;
        return;
      } else {
        deviceList = deviceListArray[0];
      }
      snmpSession = snmp.createSession(
        deviceList.IPAddress,
        'public',
        snmpOptions,
      );
      //console.log('going next');
      let currentPortUpDetails = [];
      let diffPortDetails = [];
      snmpSession.subtree(
        '1.3.6.1.2.1.2.2.1.8',
        40,
        varbinds => {
          try {
            for (var i = 0; i < varbinds.length; i++) {
              if (snmp.isVarbindError(varbinds[i]))
                console.error(snmp.varbindError(varbinds[i]));
              else {
                //console.log(varbinds[i].oid + '|' + varbinds[i].value);
                const iport = 'port-' + i;
                if (firstRun) {
                  prevPortUpDetails.push({
                    port: iport,
                    value: varbinds[i].value,
                  });
                } else {
                  currentPortUpDetails.push({
                    port: iport,
                    value: varbinds[i].value,
                  });
                }
              }
            }
            if (!firstRun) {
              diffPortDetails = [
                ...comparePortDetails(prevPortUpDetails, currentPortUpDetails),
              ];
            }

            if (diffPortDetails.length > 0) {
              prevPortUpDetails = currentPortUpDetails.slice();
              const teegramMsgData = {
                severity: 'Critical',
                sourceIP: deviceList.IPAddress,
                model: deviceList.model,
                MACAddress: deviceList.MACAddress,
              };
              diffPortDetails.forEach(d => {
                if (d.value === 2) {
                  eventLogManagement.default.updateEventLog(
                    {
                      specific: 2,
                      sourceIP: deviceList.IPAddress,
                      msg: `${d.port} link down`,
                    },
                    'custom',
                  );
                  //console.log(`${d.port} link down`);
                } else {
                  eventLogManagement.default.updateEventLog(
                    {
                      specific: 3,
                      sourceIP: deviceList.IPAddress,
                      msg: `${d.port} link up`,
                    },
                    'custom',
                  );
                  //console.log(`${d.port} link up`);
                }
              });
            }

            //console.log('cisco Port up and down detection forever s1');
            //console.log('previous up', prevPortUpDetails);
            //console.log('current up', currentPortUpDetails);
            //console.log('diffrence', diffPortDetails);
            firstRun = false;
            snmpSession.close();
            detectTaskParams.timeout = setTimeout(() => {
              next();
            }, 5000);
            detectTaskParams.callback = next;
          } catch (err) {
            console.log(err);
            console.log('cisco Port up and down detection forever e1');
            snmpSession.close();
            detectTaskParams.timeout = setTimeout(() => {
              next();
            }, 5000);
            detectTaskParams.callback = next;
          }
        },
        error => {
          if (error) {
            //console.log(error);
            //console.log('cisco Port up and down detection forever e2');
            //snmpSession && snmpSession.close();
            detectTaskParams.timeout = setTimeout(() => {
              next();
            }, 5000);
            detectTaskParams.callback = next;
          }
        },
      );
    },
    error => {
      // if next is called with a value in its first parameter, it will appear
      // in here as 'err', and execution will stop.
      if (error) {
        console.error('cisco Port up and down detection forever error');
      }
    },
  );
}

export default { start, getCiscoDeviceDetails };

function getCiscoDeviceDetails() {
  let defaultDeviceData = {};
  const onlineDeviceList = deviceIntegration.default.getDeviceGroupList();
  Object.entries(onlineDeviceList).forEach(([groupKey, groupValue]) => {
    Object.values(groupValue.deviceList).forEach(device => {
      defaultDeviceData = {
        ...defaultDeviceData,
        [device.MACAddress]: {
          ...device,
        },
      };
    });
  });
  const onlineArrayDeviceList = Object.values(defaultDeviceData);
  const onlineCiscoDevice = onlineArrayDeviceList.filter(
    fd => fd.model === 'Cisco CGS2520' && fd.isAUZ,
  );
  return { deviceListArray: onlineCiscoDevice, onlineArrayDeviceList };
}

function comparePortDetails(a, b) {
  // A comparer used to determine if two entries are equal.
  const isSamePortInfo = (a, b) => a.port === b.port && a.value === b.value;
  const onlyInLeft = (left, right, compareFunction) =>
    left.filter(
      leftValue =>
        !right.some(rightValue => compareFunction(leftValue, rightValue)),
    );

  //const onlyInA = onlyInLeft(a, b, isSamePortInfo);
  const onlyInB = onlyInLeft(b, a, isSamePortInfo);

  return [...onlyInB];
}
