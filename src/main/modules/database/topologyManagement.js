import { ipcMain } from 'electron';
import { apiCore, topology } from '..';
import {
  REQUEST_MP_SAVE_TOPOLOGY_LAYOUT,
  RESPONSE_RP_SAVE_TOPOLOGY_LAYOUT,
} from '../../utils/IPCEvents';

const updateDBLayout = arg => {
  try {
    let nodes = [];
    let edges = [];

    Object.entries(arg.positions).forEach(([key, value]) => {
      nodes = [
        ...nodes,
        {
          name: key,
          x: value.x,
          y: value.y,
        },
      ];
    });
    Object.entries(arg.edgesData).forEach(([key, value]) => {
      edges = [
        ...edges,
        {
          link: key,
          portName: value.leftPort,
          remotePortName: value.rightPort,
        },
      ];
    });

    let groupId;
    if (arg.currentGroup === 'all') {
      groupId = 0;
    } else {
      groupId = arg.currentGroup;
    }
    const result = apiCore.db.updateTopologyLayout(
      { nodes, edges, groupId },
      true,
    );
    if (result) {
      topology.updateUserLayout({ nodes, edges });
    }
    return result;
  } catch (error) {
    console.error(error);
    return false;
  }
};

export default { updateDBLayout };

ipcMain.on(REQUEST_MP_SAVE_TOPOLOGY_LAYOUT, (event, arg) => {
  const eventName = RESPONSE_RP_SAVE_TOPOLOGY_LAYOUT;
  //console.log(arg);
  try {
    if (arg === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found layout',
      });
      return;
    }
    if (updateDBLayout(arg)) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Save topology layout successful',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Save topology layout error.',
    });
  }
});
