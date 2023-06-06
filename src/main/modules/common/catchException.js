import { ipcMain, dialog, app } from 'electron';
import async from 'async';
import fs from 'fs';
import { queueManagement } from '..';
import { REQUEST_MP_LOG_EXCEPTION } from '../../utils/IPCEvents';

function format(Date) {
  const Y = Date.getFullYear();
  let M = Date.getMonth() + 1;
  M = M < 10 ? `0${M}` : M; // 不够两位补充0
  let D = Date.getDate();
  D = D < 10 ? `0${D}` : D;
  let H = Date.getHours();
  H = H < 10 ? `0${H}` : H;
  let Mi = Date.getMinutes();
  Mi = Mi < 10 ? `0${Mi}` : Mi;
  let S = Date.getSeconds();
  S = S < 10 ? `0${S}` : S;
  return `${Y}-${M}-${D} ${H}:${Mi}:${S}`;
}

// handle exception
process.on('uncaughtException', error => {
  console.log(`Caught exception: ${error.toString()} `);
  if (app.isReady()) {
    dialog.showMessageBox({
      type: 'error',
      title: 'Caught exception',
      message: error.toString(),
    });
  }
});

// Caught exception from all console.error
console.error = arg => {
  queueManagement.default.add(exceptionQueue, { type: 'MP', error: arg });
  console.log(arg);
};

// write exception queue task
const exceptionQueue = async.queue((tmp, callback) => {
  try {
    const dateNow = new Date();
    fs.appendFile(
      'log.log',
      `[${format(dateNow)}][${tmp.type}] ${tmp.error} \r\n`,
      err => {
        if (err) return console.log(err);
        callback();
      },
    );
  } catch (error) {
    console.error(error);
    callback();
  }
}, 1);

// log exception
ipcMain.on(REQUEST_MP_LOG_EXCEPTION, (event, arg) => {
  try {
    queueManagement.default.add(exceptionQueue, { type: 'RP', error: arg });
  } catch (error) {
    console.error(error);
  }
});
