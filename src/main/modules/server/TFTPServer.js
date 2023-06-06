import tftp from 'tftp';
import path from 'path';

let server;
let closed = true;
const connections = [];

const rootFolderPath =
  process.env.APPDATA ||
  (process.platform == 'darwin'
    ? process.env.HOME + '/Library/Preferences'
    : process.env.HOME + '/.local/share');
const root = path.join(rootFolderPath, '/NMUbackupConfigs/');

export const isServerAlive = () => server !== undefined;

export const startServer = host => {
  try {
    server = tftp.createServer({
      host,
      port: 69,
      root: path.resolve(root),
    });

    /* eslint-disable */
    server.on('request', function(req) {
      req.on('error', function(error) {
        // Error from the request
        console.error(error);
      });

      // Save the connection
      connections.push(req);

      // The "close" event is fired when the internal socket closes, regardless
      // whether it is produced by an error, the socket closes naturally due to the
      // end of the transfer or the transfer has been aborted
      req.on('close', function() {
        // Remove the connection
        connections.splice(connections.indexOf(this), 1);
        if (closed && !connections.length) {
          // The server and all the connections have been closed
          console.log('Server closed');
        }
      });
    });
    /* eslint-enable */
    //   /* eslint-disable func-names */
    //   function(req, res) {
    //     connections.push(req);
    //     req.on('close', () => {
    //       // Remove the connection
    //       connections.splice(connections.indexOf(this), 1);
    //       if (closed && !connections.length) {
    //         // The server and all the connections have been closed
    //         console.log('Server closed');
    //       }
    //     });

    //     this.requestListener(req, res);
    //   },
    //   /* eslint-enable */
    // );

    server.on('error', error => {
      // Errors from the main socket
      console.error(error);
    });

    server.listen();
    closed = false;
    server.on('close', () => {
      console.log('server close');
      server = undefined;
      closed = true;

      if (!connections.length) {
        return console.log('Server closed');
      }
      // Abort all the current transfers
      for (let i = 0; i < connections.length; i += 1) {
        console.log(`Connection ${i} aborted`);
        connections[i].abort();
      }
    });

    server.on('listening', () => {
      console.log('TFTP Server running.');
    });
  } catch (error) {
    console.error(error);
  }
};

export const closeServer = () => {
  server.close();
};
