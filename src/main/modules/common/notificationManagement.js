import { Notification } from 'electron';
import { snmp } from '..';
import notifier from 'node-notifier';
import os from 'os';

const appId = 'com.develar.NetworkManagementUtility';

const platform = os.platform();
const dw = os.release().split('.');
const dwMajorVersion = dw[0];
const dwMinorVersion = dw[1];

const SUPPORT_WIN8_SERVER_2012_OR_HIGHER =
  platform === 'win32' &&
  ((dwMajorVersion >= 6 && dwMinorVersion >= 2) || dwMajorVersion === 10);

const icon = './resources/notification.png';
// Send to ipcRenderer
function showDeviceOnline(isOnline, modelInfo) {
  try {
    let modelName = modelInfo.model;
    if (modelName.length > 28) {
      modelName = `${modelName.substring(0, 28)}...`;
    }
    // follow https://docs.microsoft.com/zh-tw/windows/desktop/api/winnt/ns-winnt-_osversioninfoa

    // Support for Windows 8 / Server 2012 or higher
    if (SUPPORT_WIN8_SERVER_2012_OR_HIGHER) {
      const options = {
        title: isOnline ? 'Device online' : 'Device offline',
        message: `${modelName}\nIP address: ${modelInfo.IPAddress}\nMAC address: ${modelInfo.MACAddress}`,
        icon,
        appID: appId,
      };
      notifier.notify(options);
      notifier.on('click', () => {
        console.info('clicked!!');
      });
    } else {
      // Support for Windows 7 / Server 2008, linux and macOS
      const options = {
        title: isOnline ? 'Device online' : 'Device offline',
        body: `${modelName}\nIP address: ${modelInfo.IPAddress}\nMAC address: ${modelInfo.MACAddress}`,
        silent: true,
        icon,
      };
      const n = new Notification(options);
      n.on('click', () => console.info('clicked!!'));
      n.show();
    }
  } catch (error) {
    console.error(error);
  }
}

function showAnyFault(isPort, isUpOROn, name, MACAddress) {
  const session = snmp.default.getSNMPSessionList()[MACAddress];

  let title;
  if (isPort) {
    title = `${name} ${isUpOROn ? 'Link Up' : 'Link Down'}`;
  } else {
    title = `${name} ${isUpOROn ? 'On' : 'Off'}`;
  }
  if (SUPPORT_WIN8_SERVER_2012_OR_HIGHER) {
    const options = {
      title,
      message: `${session.sysDescr}\nIP Address: ${session.IPAddress}\nMAC Address: ${MACAddress}`,
      icon,
      appID: appId,
    };
    notifier.notify(options);
    notifier.on('click', () => {
      console.info('clicked!!');
    });
  } else {
    const options = {
      title,
      body: `${session.sysDescr}\nIP Address: ${session.IPAddress}\nMAC Address: ${MACAddress}`,
      silent: true,
      icon,
    };
    const n = new Notification(options);
    n.on('click', () => console.info('clicked!!'));
    n.show();
  }
}

// function showPowerAnyFault(isOn, powerName, MACAddress) {
//   const session = snmp.getSNMPSessionList()[MACAddress];
//   if (SUPPORT_WIN8_SERVER_2012_OR_HIGHER) {
//     const options = {
//       title: `${powerName} is ${isOn ? 'On' : 'Off'}`,
//       message: `${session.sysDescr}\nIP Address: ${
//         session.IPAddress
//       }\nMAC Address: ${MACAddress}`,
//       icon,
//       appID: appId,
//     };
//     notifier.notify(options);
//     notifier.on('click', () => {
//       console.info('clicked!!');
//     });
//   } else {
//     const options = {
//       title: `${powerName} is ${isOn ? 'On' : 'Off'}`,
//       body: `${session.sysDescr}\nIP Address: ${
//         session.IPAddress
//       }\nMAC Address: ${MACAddress}`,
//       silent: true,
//       icon,
//     };
//     const n = new Notification(options);
//     n.on('click', () => console.info('clicked!!'));
//     n.show();
//   }
// }

export default { showDeviceOnline, showAnyFault };
