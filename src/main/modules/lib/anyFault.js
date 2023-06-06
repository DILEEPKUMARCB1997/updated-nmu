// Definitions by: AlexLin

import async from 'async';
import {
  apiCore,
  snmp,
  notificationManagement,
  progressManagement,
  eventLogManagement,
} from '..';

let newSNMPDeviceQueue = [];

let alarmSettingCollection = {};
let prePortPowerStatus = {};

const POLLING_INTERVA = 5000;

const getPreMACList = () => Object.keys(alarmSettingCollection);
const anyFaultNext = next => {
  setTimeout(() => {
    next();
  }, POLLING_INTERVA);
};

const start = () => {
  progressManagement.default.addProgress('anyFault', 'polling');
  async.forever(
    next => {
      try {
        if (!progressManagement.default.isProgressing('SNMP', 'initialize')) {
          console.log('Any fault check begin.');
          checkHaveNewDevice(); // check new device first time;
          if (newSNMPDeviceQueue.length !== 0) {
            getDBAlarmSettingCollection(); // get new device settings.
          }
          changeCheckDeviceStatus();
        }
        anyFaultNext(next);
      } catch (exception) {
        // console.log('poaling1');
        console.error(exception);
        anyFaultNext(next);
      }
    },
    error => {
      progressManagement.default.removeProgress('anyFault', 'polling');
      // console.log('poaling2');
      console.error(error);
    },
  );
};

const checkHaveNewDevice = () => {
  const SNMPMACInGroupList = snmp.default.getSNMPMACInGroupList(0);
  newSNMPDeviceQueue = SNMPMACInGroupList.filter(
    MACAddress => !getPreMACList().includes(MACAddress),
  );
  Object.keys(alarmSettingCollection).forEach(MACAddress => {
    if (!SNMPMACInGroupList.includes(MACAddress)) {
      delete alarmSettingCollection[MACAddress];
      // delete prePortPowerStatus[MACAddress];
    }
  });
};

const getDBAlarmSettingCollection = () => {
  console.log(`Any fault new devices: ${newSNMPDeviceQueue}`);
  newSNMPDeviceQueue.forEach(MACAddress => {
    const alarmSetting = apiCore.db.getDeviceAlarmSettings(
      { MACAddress },
      true,
    );
    let portInfo = {};
    let powerInfo = {};
    if (alarmSetting) {
      alarmSetting.forEach(settings => {
        if (settings.type === 'port') {
          portInfo = { ...portInfo, [settings.name]: settings.status };
        } else if (settings.type === 'power') {
          powerInfo = { ...powerInfo, [settings.name]: settings.status };
        }
      });

      alarmSettingCollection = {
        ...alarmSettingCollection,
        [MACAddress]: {
          portInfo,
          powerInfo,
        },
      };

      if (prePortPowerStatus[MACAddress] === undefined) {
        forceCheckDeviceStatus(MACAddress);
      }
    } else {
      newSNMPDeviceQueue.splice(newSNMPDeviceQueue.indexOf(MACAddress), 1);
    }
  });
};

const forceCheckDeviceStatus = MACAddress => {
  snmp.default.getPortPowerMIBData(MACAddress, currentPortPowerStatus => {
    forceNotificationTrigger(
      true,
      alarmSettingCollection[MACAddress].portInfo,
      currentPortPowerStatus.portInfo,
      MACAddress,
    );
    forceNotificationTrigger(
      false,
      alarmSettingCollection[MACAddress].powerInfo,
      currentPortPowerStatus.powerInfo,
      MACAddress,
    );
    savePortPowerStatus(MACAddress, currentPortPowerStatus);
    newSNMPDeviceQueue.splice(newSNMPDeviceQueue.indexOf(MACAddress), 1);
  });
};

const changeCheckDeviceStatus = () => {
  console.log(
    `Any fault check devices: ${Object.keys(alarmSettingCollection)}`,
  );
  Object.entries(alarmSettingCollection).forEach(([MACAddress, settings]) => {
    const preStatus = prePortPowerStatus[MACAddress];
    if (preStatus !== undefined) {
      snmp.default.getPortPowerMIBData(MACAddress, currentPortPowerStatus => {
        changeNotificationTrigger(
          true,
          settings.portInfo,
          preStatus.portInfo,
          currentPortPowerStatus.portInfo,
          MACAddress,
        );
        changeNotificationTrigger(
          false,
          settings.powerInfo,
          preStatus.powerInfo,
          currentPortPowerStatus.powerInfo,
          MACAddress,
        );
        savePortPowerStatus(MACAddress, currentPortPowerStatus);
      });
    }
  });
};

const changeNotificationTrigger = (
  isPort,
  settings,
  preStatus,
  currentStatus,
  MACAddress,
) => {
  Object.entries(settings).forEach(([name, set]) => {
    if (
      set.charAt(0) === '1' &&
      preStatus[name] === 2 &&
      currentStatus[name] === 1
    ) {
      notificationManagement.default.showAnyFault(
        isPort,
        true,
        name,
        MACAddress,
      );
      eventLogManagement.default.updateEventLog({
        MACAddress,
        type: 'anyFault',
        msg: `${name} ${isPort ? 'link up' : 'is on'}.`,
      });
    } else if (
      set.charAt(1) === '1' &&
      preStatus[name] === 1 &&
      currentStatus[name] === 2
    ) {
      notificationManagement.default.showAnyFault(
        isPort,
        false,
        name,
        MACAddress,
      );
      eventLogManagement.default.updateEventLog({
        MACAddress,
        type: 'anyFault',
        msg: `${name} ${isPort ? 'link down' : 'is off'}.`,
      });
    }
  });
};

const forceNotificationTrigger = (
  isPort,
  settings,
  currentStatus,
  MACAddress,
) => {
  Object.entries(settings).forEach(([name, set]) => {
    if (set.charAt(0) === '1' && currentStatus[name] === 1) {
      notificationManagement.default.showAnyFault(
        isPort,
        true,
        name,
        MACAddress,
      );
      eventLogManagement.default.updateEventLog({
        MACAddress,
        type: 'anyFault',
        msg: `${name} ${isPort ? 'link up' : 'is on'}.`,
      });
    } else if (set.charAt(1) === '1' && currentStatus[name] === 2) {
      notificationManagement.default.showAnyFault(
        isPort,
        false,
        name,
        MACAddress,
      );
      eventLogManagement.default.updateEventLog({
        MACAddress,
        type: 'anyFault',
        msg: `${name} ${isPort ? 'link down' : 'is off'}.`,
      });
    }
  });
};

const savePortPowerStatus = (MACAddress, status) => {
  prePortPowerStatus = {
    ...prePortPowerStatus,
    [MACAddress]: status,
  };
};

export const updateAlarmSettingCollection = newStatus => {
  const { MACAddress, portInfo, powerInfo } = newStatus;
  alarmSettingCollection = {
    ...alarmSettingCollection,
    [MACAddress]: {
      portInfo,
      powerInfo,
    },
  };
  forceCheckDeviceStatus(MACAddress);
};

export default start;
