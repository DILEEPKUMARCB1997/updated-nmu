/* UDP server module */

import dgram from 'dgram';
import { gwd } from '..';

let server = dgram.createSocket('udp4');

function bind(host, port) {
  try {
    // rebind udp server,if udp server was bound.

    server.close();
    server = dgram.createSocket('udp4');

    // catch error message.
    server.on('error', err => {
      console.log(`server error:\n${err.stack}`);
    });

    server.on('message', msg => {
      // console.log(msg);
      gwd.default.broadcastReceiver(msg);
      // console.log(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
    });

    server.on('listening', () => {
      const address = server.address();
      console.log(`server listening ${address.address}:${address.port}`);
    });
    console.log(host);
    server.bind(
      {
        address: host,
        port,
        exclusive: true,
      },
      () => {
        server.setBroadcast(true);
      },
    );
  } catch (error) {
    console.error(error);
  }
}

// export send function
function send(message, ip, port) {
  try {
    server.send(message, 0, message.length, port, ip, () => {
      //console.log("Sent '" + message + "'");
    });
  } catch (error) {
    console.error(error);
  }
}

export default { bind, send };
