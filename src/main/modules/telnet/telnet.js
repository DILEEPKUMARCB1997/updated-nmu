import { ipcMain } from 'electron';
import ChildProcess from 'child_process';
import {
  REQUEST_MP_OPEN_TELNET,
} from '../../utils/IPCEvents';

ipcMain.on(REQUEST_MP_OPEN_TELNET, (event, arg) => {
  const host = arg;
  console.log(`********************************Telnet ${host}********************************`);
  ChildProcess.exec(`start cmd.exe /K telnet ${host}`);
});

