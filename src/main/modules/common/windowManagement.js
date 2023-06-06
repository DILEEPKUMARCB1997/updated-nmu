import { BrowserWindow } from 'electron';

const windows = {};

// set the window id
function setWindow(params) {
  windows[params.winName] = params.id;
}
// Send to ipcRenderer
function send(winName, eventName, data) {
  try {
    const mainWindow = BrowserWindow.fromId(windows[winName]);
    mainWindow.webContents.send(eventName, data);
  } catch (error) {
    console.error(error);
  }
}
function getWindow(winName) {
  const mainWindow = BrowserWindow.fromId(windows[winName]);
  return mainWindow;
}
export default { setWindow, send, getWindow };
