import { ipcMain, app, Notification, Audio } from 'electron';
import { windowManagement } from '..';

const appId = 'com.develar.NetworkManagementUtility';
app.setAppUserModelId(appId);
ipcMain.on('ipcRenderer test', (event, arg) => {
  try {
    // windowManagement.send('mainId', 'ipcMain test', {});
    const options = {
      title: 'Device online',
      body:
        'Managed Switch, EHG7508-8PoE\nIP address:10.0.176.11\nMAC address:00:60:E9:1E:A9:AB',
      silent: true,
      icon: './resources/icon.png',
    };
    const n = new Notification(options);
    n.on('show', () => console.log('show!!'));
    n.on('close', () => console.log('close!!'));
    n.on('click', () => console.log('clicked!!'));

    n.show();
    console.log(n);
  } catch (error) {
    console.log(error);
  }
});
