import fs from 'fs';
import mv from 'mv';
const Telnet = require('telnet-client');
const pathRoot = require('path');

const rootFolderPath =
  process.env.APPDATA ||
  (process.platform == 'darwin'
    ? process.env.HOME + '/Library/Preferences'
    : process.env.HOME + '/.local/share');
const root = pathRoot.join(rootFolderPath, '/NMUbackupConfigs/');

async function telnetClient(element, name, host, MACAddress, path) {
  const fileMAC = MACAddress.replace(/:/g, '');
  // const path = root + fileMAC;
  const connection = new Telnet();
  const opt = {
    execTimeout: 15000,
  };

  connection.on('ready', async function(prompt) {
    await connection.exec(
      `copy running-config tftp ${host} ${name}.txt`,
      opt,
      function(err, response) {
        console.log(response);
        if (response === '% Unknown command.\nswitch') {
          // console.log('EH device');
          ehDevice();
        } else {
          connection.end();
        }
        //fs.renameSync(`${root}${name}.txt`, `${path}/${name}.txt`);
        if (err) console.log('ready error', err);
      },
    );
    console.log('ready');
  });
  connection.on('close', function() {
    console.log('connection closed');
    if (!fs.existsSync(`${root}${name}.txt`)) {
      console.log('file doesnot exists');
    } else {
      mv(
        `${root}${name}.txt`,
        `${path}/${name}.txt`,
        { mkdirp: true },
        function(err) {
          if (err) throw err;
        },
      );
    }
    //fs.renameSync(`${root}${name}.txt`, `${path}/${name}.txt`);
  });
  connection.connect(element);
  async function ehDevice() {
    await connection.exec(`config`, opt, async function(err, response) {
      console.log(response);
      if (response === 'switch(config)') {
        console.log('EH1 device');
        await connection.exec(
          `copy running-config tftp ${host} ${name}.txt`,
          opt,
          function(err, response) {
            console.log('response EH', response);
            if (response === '% Unknown command.\nswitch') {
              //console.log('EH device');
              connection.end();
            } else {
              connection.end();
            }
          },
        );
      } else {
        connection.end();
      }
    });
  }
}
export const tlenetClient = telnetClient;
