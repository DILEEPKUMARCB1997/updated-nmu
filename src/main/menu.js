// @flow
import { app, Menu, shell, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import archiver from 'archiver';
import unzip from 'node-unzip-2';
import { result } from 'lodash';
import { SEND_RP_OPEN_NATIVE_MENU } from './utils/IPCEvents';

const rootFolderPath =
  process.env.APPDATA ||
  (process.platform === 'darwin'
    ? process.env.HOME + '/Library/Preferences'
    : process.env.HOME + '/.local/share');

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

export default class MenuBuilder {
  mainWindow;

  constructor(mainWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu() {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment() {
    this.mainWindow.openDevTools();
    this.mainWindow.webContents.on('context-menu', (e, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.inspectElement(x, y);
          },
        },
      ]).popup(this.mainWindow);
    });
  }

  buildDarwinTemplate() {
    const subMenuAbout = {
      label: 'Electron',
      submenu: [
        {
          label: 'About ElectronReact',
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: 'Hide ElectronReact',
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp = {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click() {
            shell.openExternal('http://electron.atom.io');
          },
        },
        {
          label: 'Documentation',
          click() {
            shell.openExternal(
              'https://github.com/atom/electron/tree/master/docs#readme'
            );
          },
        },
        {
          label: 'Community Discussions',
          click() {
            shell.openExternal('https://discuss.atom.io/c/electron');
          },
        },
        {
          label: 'Search Issues',
          click() {
            shell.openExternal('https://github.com/atom/electron/issues');
          },
        },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ? subMenuViewDev : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: 'File',
        submenu: [
          {
            label: '&Preference...',
            accelerator: 'Ctrl+P',
            click: () => {
              this.mainWindow.webContents.send(SEND_RP_OPEN_NATIVE_MENU, {
                action: 'preference',
              });
            },
          },
          {
            label: '&Import Settings...',
            accelerator: 'Ctrl+I',
            click: () => {
              dialog
                .showOpenDialog(this.mainWindow, {
                  title: 'Select file',
                  filters: [{ name: 'bak', extensions: ['bak'] }],
                  properties: ['openFile'],
                })
                .then((result) => {
                  if (result.filePaths === undefined || result.canceled) {
                    return;
                  }
                  fs.createReadStream(result.filePaths[0])
                    .pipe(unzip.Extract({ path: './_tmp' }))
                    .on('close', () => {
                      fs.stat('./_tmp', (err, stats) => {
                        if (err) {
                          dialog.showMessageBox(this.mainWindow, {
                            type: 'error',
                            title: 'Imported Settings...',
                            message: 'All settings imported fail.',
                          });
                          return;
                        }
                        if (!stats.isDirectory()) {
                          // This isn't a directory!
                          fs.unlinkSync('./_tmp');
                          dialog.showMessageBox(this.mainWindow, {
                            type: 'error',
                            title: 'Imported Settings...',
                            message: 'All settings imported fail.',
                          });
                          return;
                        }
                        if (
                          !fs.existsSync('./_tmp/db.bak') ||
                          !fs.existsSync('./_tmp/ini.bak')
                        ) {
                          deleteFolderRecursive('./_tmp');
                          dialog.showMessageBox(this.mainWindow, {
                            type: 'error',
                            title: 'Imported Settings...',
                            message: 'All settings imported fail.',
                          });
                          return;
                        }
                        dialog
                          .showMessageBox(this.mainWindow, {
                            type: 'info',
                            title: 'Imported settings...',
                            message:
                              'All settings imported successfully.Restart this app to take effect.',
                            buttons: ['Yes', 'No'],
                          })
                          .then((result) => {
                            if (result.response === 0) {
                              app.relaunch();
                              app.exit(0);
                            }
                          });
                      });
                    })
                    .on('error', () => {
                      deleteFolderRecursive('./_tmp');
                      dialog.showMessageBox(this.mainWindow, {
                        type: 'error',
                        title: 'Imported Settings',
                        message: 'All settings imported fail.',
                      });
                    });
                })
                .catch((err) => {
                  deleteFolderRecursive('./_tmp');
                  dialog.showMessageBox(this.mainWindow, {
                    type: 'error',
                    title: 'Imported Settings',
                    message: 'All settings imported fail.',
                  });
                });
            },
          },
          {
            label: '&Export Settings...',
            accelerator: 'Ctrl+E',
            click: () => {
              const options = {
                title: 'Save As',
                filters: [{ name: 'File', extensions: ['bak'] }],
              };
              dialog
                .showSaveDialog(this.mainWindow, options)
                .then((result) => {
                  try {
                    if (result.filePath === undefined || result.canceled) {
                      return;
                    }
                    if (
                      !fs.existsSync(`${rootFolderPath}/NMUDb/profile.db`) ||
                      !fs.existsSync('./config.ini')
                    ) {
                      dialog.showMessageBox(this.mainWindow, {
                        type: 'error',
                        title: 'Export settings...',
                        message: 'All settings exported fail.',
                      });
                      return;
                    }

                    const output = fs.createWriteStream(result.filePath);
                    const archive = archiver('zip', {
                      gzip: true,
                      zlib: { level: 9 }, // Sets the compression level.
                    });

                    archive.on('error', (error) => {
                      console.log(error);
                    });

                    output.on('close', () => {
                      dialog.showMessageBox(this.mainWindow, {
                        type: 'info',
                        title: 'Export settings...',
                        message: 'All settings exported successfully.',
                      });
                    });

                    // pipe archive data to the output file
                    archive.pipe(output);

                    // append files
                    archive.file(`${rootFolderPath}/NMUDb/profile.db`, {
                      name: 'db.bak',
                    });
                    archive.file('./config.ini', { name: 'ini.bak' });

                    archive.finalize();
                  } catch (error) {
                    dialog.showMessageBox(this.mainWindow, {
                      type: 'error',
                      title: 'Export settings...',
                      message: 'All settings exported fail.',
                    });
                  }
                })
                .catch((err) => {
                  dialog.showMessageBox(this.mainWindow, {
                    type: 'error',
                    title: 'Export settings...',
                    message: 'All settings exported fail.',
                  });
                });
            },
          },
          { type: 'separator' },
          {
            label: '&Quit',
            accelerator: 'Ctrl+Q',
            click: () => {
              this.mainWindow.close();
            },
          },
        ],
      },
      {
        label: 'View',
        submenu:
          process.env.NODE_ENV === 'development'
            ? [
                {
                  label: '&Reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen()
                    );
                  },
                },
                {
                  label: 'Toggle &Developer Tools',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.toggleDevTools();
                  },
                },
              ]
            : [
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen()
                    );
                  },
                },
              ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About Network Management Utility',
            click: () => {
              this.mainWindow.webContents.send(SEND_RP_OPEN_NATIVE_MENU, {
                action: 'about',
              });
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
