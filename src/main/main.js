/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  shell,
  Tray,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import installExtension, {
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS,
} from 'electron-devtools-assembler';
import fs from 'fs';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  apiCore,
  sqlExtensions,
  windowManagement,
  iniReader,
  deviceIntegration,
  iFaceManagement,
  udpServer,
  snmpManagement,
} from './modules/index';
import {
  REQUEST_CHANGE_THEME_MODE,
  REQUEST_HIDE_SHOW_MENU,
  REQUEST_MP_GET_APP_INITIAL_DATA,
  REQUEST_MP_UPDATE_MENU,
  RESPONSE_RP_GET_APP_INITIAL_DATA,
} from './utils/IPCEvents';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

const rootFolderPath =
  process.env.APPDATA ||
  (process.platform === 'darwin'
    ? process.env.HOME + '/Library/Preferences'
    : process.env.HOME + '/.local/share');
const folderPaths = ['./NMUbackupConfigs'];

function deleteFolderRecursive(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach((file) => {
      const curPath = `${path}/${file}`;
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath);
      } else {
        // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
}

function checkImportFile() {
  try {
    if (!fs.statSync('./_tmp').isDirectory()) {
      fs.unlinkSync('./_tmp');
      return false;
    }
    if (!fs.existsSync('./_tmp/db.bak') || !fs.existsSync('./_tmp/ini.bak')) {
      deleteFolderRecursive('./_tmp');
      return false;
    }
    fs.copyFileSync('./_tmp/db.bak', './profile.db');
    fs.copyFileSync('./_tmp/ini.bak', './config.ini');
    deleteFolderRecursive('./_tmp');
    return true;
  } catch (err) {
    return true;
  }
}

let menu;
let mainWindow = null;
let tray = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  return installExtension([REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS])
    .then((name) => console.log(`Added Extension:  ${name}`))
    .catch((err) => console.log('An error occurred: ', err));
};

function initialize() {
  app.setAppUserModelId('org.develar.NetworkManagementUtility');
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  const checkFolders = () => {
    const path = require('path');
    folderPaths.forEach((path1) => {
      if (!fs.existsSync(path.join(rootFolderPath, path1))) {
        fs.mkdirSync(path.join(rootFolderPath, path1));
      }
    });
  };

  const createWindow = async (loading) => {
    if (isDebug) {
      await installExtensions();
    }

    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');

    const getAssetPath = (...paths) => {
      return path.join(RESOURCES_PATH, ...paths);
    };

    mainWindow = new BrowserWindow({
      title: 'Network Management Utility',
      minWidth: 1280,
      minHeight: 720,
      show: false,
      width: 1280,
      height: 720,
      icon: getAssetPath('icon.ico'),
      maximizable: false,
      webPreferences: {
        preload: app.isPackaged
          ? path.join(__dirname, 'preload.js')
          : path.join(__dirname, '../../.erb/dll/preload.js'),
        nodeIntegration: true,
        webviewTag: true,
      },
    });

    mainWindow.loadURL(resolveHtmlPath('index.html'));

    windowManagement.default.setWindow({
      winName: 'mainId',
      id: mainWindow.id,
    });

    const nimage = getAssetPath('icon.ico');
    tray = new Tray(nimage);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open NMU',
        click: () => {
          mainWindow.show();
        },
      },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Network Management Utility');
    tray.setContextMenu(contextMenu);

    mainWindow.webContents.on('dom-ready', () => {
      try {
        if (!iniReader.default.iniInitialize()) {
          dialog.showErrorBox('ini Error', 'ini config read failed!');
          app.quit();
        }
        console.log('Checking ini...Done');
        deviceIntegration.default.initializeList(true);
      } catch (error) {
        console.error(error);
      }
    });

    mainWindow.webContents.once('dom-ready', () => {
      if (!mainWindow) {
        throw new Error('mainWindow is not defined');
      }
      if (process.env.START_MINIMIZED) {
        mainWindow.minimize();
      } else {
        mainWindow.maximize();
        mainWindow.show();
        mainWindow.focus();
        loading.hide();
        loading.close();
      }
    });

    mainWindow.on('close', (event) => {
      if (!app.isQuiting) {
        event.preventDefault();
        mainWindow.hide();
      }
      return false;
    });

    mainWindow.on('show', () => {
      console.log('windows shown done !');
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    const menuBuilder = new MenuBuilder(mainWindow);
    menu = menuBuilder.buildMenu();
    mainWindow.setMenuBarVisibility(false);
    // Open urls in the user's browser
    mainWindow.webContents.setWindowOpenHandler((edata) => {
      shell.openExternal(edata.url);
      return { action: 'deny' };
    });
    // eslint-disable-next-line
    new AppUpdater();
  };
  app.commandLine.appendSwitch('ignore-certificate-errors', 'true');

  app
    .whenReady()
    .then(() => {
      const loading = new BrowserWindow({
        show: false,
        frame: false,
        webPreferences: {
          preload: app.isPackaged
            ? path.join(__dirname, 'preload.js')
            : path.join(__dirname, '../../.erb/dll/preload.js'),
          nodeIntegration: true,
        },
      });

      loading.loadURL(resolveHtmlPath('splash.html'));

      loading.once('show', () => {
        setTimeout(() => createWindow(loading), 3000);
      });

      loading.webContents.on('did-finish-load', () => {
        if (!loading) {
          throw new Error('mainWindow is not defined');
        }
        loading.show();
        loading.focus();
      });

      app.on('activate', () => {
        if (mainWindow === null) createWindow();
      });
    })
    .catch(console.log);
}

/**
 * Add event listeners...
 */
if (!apiCore.method.calculateChecksum({}, true)) {
  dialog.showErrorBox('Checksum failed', 'Checksum failed!');
  app.exit();
}
if (!checkImportFile()) {
  dialog.showErrorBox('Imported Error', 'Imported failed!');
}
if (!sqlExtensions.default.tableExists()) {
  console.log('Checking table...Done');
}
if (!sqlExtensions.default.isDbExists()) {
  dialog.showErrorBox('Database Error', 'Checking the database failed!');
  app.exit();
} else {
  console.log('Checking database...Done');
  const iFace = iFaceManagement.default.getCurrentNetworkInterface();
  if (!iFace.success) {
    dialog.showErrorBox(
      'NetworkInterface Error',
      'Get NetworkInterface data failed!'
    );
    app.exit();
  } else {
    udpServer.default.bind(iFace.data.IPAddress, 55954);
  }
  initialize();
}

ipcMain.on(REQUEST_MP_UPDATE_MENU, (event, arg) => {
  // disable meun item
  menu.items[arg.position[0]].submenu.items[arg.position[1]].enabled =
    arg.enabled;
});

ipcMain.on(REQUEST_HIDE_SHOW_MENU, (event, arg) => {
  mainWindow.setMenuBarVisibility(arg);
});

ipcMain.on(REQUEST_CHANGE_THEME_MODE, (event, arg) => {
  if (arg === 'dark') {
    nativeTheme.themeSource = 'dark';
  } else {
    nativeTheme.themeSource = 'light';
  }
});

ipcMain.on(REQUEST_MP_GET_APP_INITIAL_DATA, (event) => {
  const appInitialData = {
    SNMP: {
      ...snmpManagement.default.getSNMPInitialData(),
    },
  };

  event.sender.send(RESPONSE_RP_GET_APP_INITIAL_DATA, {
    success: true,
    data: { appInitialData },
  });
});
