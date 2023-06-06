import async from 'async';
import {
  snmp,
  windowManagement,
  apiCore,
  topologyManagement,
  deviceIntegration,
} from '..';
import { ipcMain } from 'electron';
import {
  REQUEST_MP_SWITCH_POLLING_TOPOLOGY,
  SEND_RP_TOPOLOGY_DATA,
  REQUEST_MP_TOPOLOGY_SET_CURRENT_GROUP,
} from '../../utils/IPCEvents';

const POLLING_INTERVA = 5000;
let realTopologyData = {};
let isStartPolling = false;
let topologyUserLayout;

let userUpdate = false;
// User data
let userNode = {};
let userEdge = {};
let userVirtualNode = {};
let userVirtualRelative = {};

let nodesData = {};
let edgesData = {};
let virtualNodeData = {};
let virtualNodeRelative = {};
const chassisIdList = {};
let currentGroupId = 0;

export const getChassisIdList = () => chassisIdList;

const lldpPollingNext = next => {
  setTimeout(() => {
    next();
  }, POLLING_INTERVA);
};

const start = () => {
  getUserLayout();
  async.forever(
    next => {
      try {
        if (isStartPolling) {
          console.log('Topology polling start.');
          getUserLayout();
          UpdateChassisIdList();
          console.log('chesisid list', chassisIdList);
          UpdateRealTopologyData(() => {
            console.log('Topology polling finish.');
            lldpPollingNext(next);
          });
        } else {
          lldpPollingNext(next);
        }
      } catch (exception) {
        console.error(exception);
        lldpPollingNext(next);
      }
    },
    error => {
      console.error(error);
    },
  );
};

const UpdateChassisIdList = () => {
  //console.log(currentGroupId);
  const getChassisTaskList = snmp.default
    .getSNMPMACInGroupList(currentGroupId)
    .map(MACAddress => callback => {
      snmp.default.getChassisId(MACAddress, callback);
    });

  async.parallel(getChassisTaskList, (error, results) => {
    try {
      if (error) {
        console.log(error);
      } else {
        results.forEach(element => {
          if (element) {
            const { MACAddress, chassisId } = element;
            chassisIdList[chassisId] = MACAddress;
          }
        });
      }
    } catch (exception) {
      console.error(exception);
    }
  });
};

const UpdateRealTopologyData = next => {
  realTopologyData = {};

  const getLLDPTaskList = snmp.default
    .getMACInGroupList(currentGroupId)
    .map(MACAddress => callback => {
      snmp.default.getLLDPData(MACAddress, callback);
    });

  //console.log('getLLDPTaskList', getLLDPTaskList);

  async.parallel(getLLDPTaskList, (error, results) => {
    try {
      if (error) {
        console.log(error);
      } else {
        results.forEach(element => {
          Object.entries(element).forEach(([MACAddress, value]) => {
            realTopologyData = { ...realTopologyData, [MACAddress]: value };
          });
        });
        //console.log('convertTopologyData', convertTopologyData());
        windowManagement.default.send(
          'mainId',
          SEND_RP_TOPOLOGY_DATA,
          convertTopologyData(),
        );
        next();
      }
    } catch (exception) {
      console.log(exception);
      next();
    }
  });
};

const covertVirtualRelative = (virtualId, element) => {
  virtualNodeRelative[virtualId][element.remoteMACAddress] =
    element.remotePortName;
};

const createConflictEdge = (commomId, virtualId, port) => {
  const oldEdge = edgesData[`${commomId}_${virtualId}`];
  let isCreated = false;
  if (oldEdge !== undefined) {
    if (oldEdge.leftPort !== port) {
      edgesData[`${commomId}_${virtualId}`] = {
        leftPort: oldEdge.leftPort,
        rightPort: '',
        status: 'nonMatch',
        realData: {
          leftPort: port,
        },
      };
      isCreated = true;
    }
  }

  if (!isCreated) {
    edgesData[`${commomId}_${virtualId}`] = {
      leftPort: port,
      rightPort: '',
      status: 'virtual',
    };
  }
};

const checkRelative = () => {
  Object.entries(userVirtualRelative).forEach(([virtualId, value]) => {
    const data = Object.entries(value);

    for (let i = 0; i < data.length; i += 1) {
      const MACAddress = data[i][0];
      const port = data[i][1];
      if (realTopologyData[MACAddress] !== undefined) {
        if (realTopologyData[MACAddress].portConflict.includes(port)) {
          virtualNodeRelative[virtualId] = {
            [MACAddress]: port,
          };
          realTopologyData[MACAddress].conflictData[port].forEach(element => {
            covertVirtualRelative(virtualId, element);
          });
          break;
        }
      }
    }
  });

  const virtualNodeRelativeList = Object.entries(virtualNodeRelative);
  const virtualNamelist = Object.keys(virtualNodeRelative);
  Object.entries(realTopologyData).forEach(([realMACAddress, value]) => {
    value.portConflict.forEach(port => {
      let foundPort = false;
      for (let i = 0; i < virtualNodeRelativeList.length; i += 1) {
        if (virtualNodeRelativeList[i][1][realMACAddress] === port) {
          const virtualId = virtualNodeRelativeList[i][0];
          createConflictEdge(realMACAddress, virtualId, port);
          foundPort = true;
          break;
        }
      }
      if (!foundPort) {
        for (let i = 0; i <= virtualNamelist.length; i += 1) {
          const newName = `virtual${i}`;
          if (!virtualNamelist.includes(newName)) {
            virtualNodeRelative[newName] = {
              ...virtualNodeRelative[newName],
              [realMACAddress]: port,
            };
            virtualNodeData[newName] = {
              status: 'virtual',
            };
            createConflictEdge(realMACAddress, newName, port);
            break;
          }
        }
      }
    });
  });
};

const convertTopologyData = () => {
  nodesData = {};
  edgesData = {};
  virtualNodeData = {};
  virtualNodeRelative = {};

  if (userUpdate) {
    convertUserLayout();
    userUpdate = false;
  }

  // console.log('Users');
  // console.log(userNode);
  // console.log(userEdge);
  // console.log(userVirtualNode);
  // console.log(virtualNodeRelative);

  nodesData = { ...userNode };
  edgesData = { ...userEdge };
  virtualNodeData = { ...userVirtualNode };

  checkRelative();
  //console.log(realTopologyData);
  Object.entries(realTopologyData).forEach(([MACAddress, value]) => {
    nodesData = {
      ...nodesData,
      [MACAddress]: {
        ...nodesData[MACAddress],
        MACAddress,
        status: 'online',
      },
    };

    value.neighbors.forEach(element => {
      let edgesDataKey;
      let leftPort;
      let rightPort;
      let blockedPort;

      // create edgeData key
      if (MACAddress < element.remoteMACAddress) {
        leftPort = element.portName;
        rightPort = element.remotePortName;
        //console.log('left');
        //console.log(leftPort);
        value.blockedPort.forEach(element => {
          //console.log(element);
          //console.log(leftPort);
          if (leftPort === element) {
            blockedPort = element;
          }
        });
        if (blockedPort !== undefined) {
          edgesDataKey = `${MACAddress}_${element.remoteMACAddress}_${leftPort}_${rightPort}`;
        }
      } else {
        leftPort = element.remotePortName;
        rightPort = element.portName;
        value.blockedPort.forEach(element => {
          //console.log(element);
          //console.log(rightPort);
          if (rightPort === element) {
            blockedPort = element;
          }
        });
        edgesDataKey = `${element.remoteMACAddress}_${MACAddress}_${leftPort}_${rightPort}`;
      }
      //console.log(edgesDataKey);
      if (edgesData[edgesDataKey] !== undefined) {
        //console.log(edgesDataKey);
        if (edgesData[edgesDataKey].status === 'notExist') {
          //console.log(blockedPort);
          edgesData = {
            ...edgesData,
            [edgesDataKey]: {
              leftPort,
              rightPort,
              blockedPort,
              status: blockedPort ? 'blocked' : 'match',
            },
          };
        } else {
          //console.log(blockedPort);
          edgesData = {
            ...edgesData,
            [edgesDataKey]: {
              leftPort,
              rightPort,
              blockedPort,
              status: blockedPort ? 'blocked' : 'nonLayout',
            },
          };
        }
      } else {
        //console.log(blockedPort);
        edgesData = {
          ...edgesData,
          [edgesDataKey]: {
            leftPort,
            rightPort,
            blockedPort,
            status: blockedPort ? 'blocked' : 'nonLayout',
          },
        };
      }
    });
  });

  // console.log(nodesData);
  //console.log(edgesData);
  // console.log(virtualNodeData);
  // console.log(virtualNodeRelative);
  return { nodesData, edgesData, virtualNodeData };
};

const convertUserLayout = () => {
  userNode = {};
  userEdge = {};
  userVirtualNode = {};
  userVirtualRelative = {};

  console.log('Start covert by user layout.');

  // Create user node
  topologyUserLayout.nodes.forEach(node => {
    if (node.name.startsWith('virtual')) {
      userVirtualNode[node.name] = {
        x: node.x,
        y: node.y,
        status: 'virtual',
      };
      userVirtualRelative[node.name] = {};
    } else {
      userNode[node.name] = {
        MACAddress: node.name,
        x: node.x,
        y: node.y,
        status: 'offline',
        IPAddress: '',
        model: '',
        hostname: '',
      };
    }
  });
  // Create user edge
  topologyUserLayout.edges.forEach(edge => {
    if (edge.link !== 'undefined') {
      const links = edge.link.split('_');
      const leftId = links[0];
      const rightId = links[1];

      if (leftId.startsWith('virtual') && rightId.startsWith('virtual')) {
        userEdge[edge.link] = {
          leftPort: '',
          rightPort: '',
          status: 'virtual',
        };
      } else if (rightId.startsWith('virtual')) {
        // Create user relative
        userVirtualRelative[rightId][leftId] = edge.portName;
        userEdge[edge.link] = {
          leftPort: edge.portName,
          rightPort: '',
          status: 'notExist',
        };
      } else {
        userEdge[edge.link] = {
          leftPort: edge.portName,
          rightPort: edge.remotePortName,
          status: 'notExist',
        };
      }
    }
  });

  console.log('Covert finish.');
};

const getUserLayout = () => {
  topologyUserLayout = apiCore.db.getUserLayouts(
    { groupId: currentGroupId },
    true,
  );
  userUpdate = true;
  //console.log('topologyUserLayout', topologyUserLayout);
};

export const layoutRemoveNodes = (groupId, MACList, isDeleteGroup) => {
  const oldLayout = apiCore.db.getUserLayouts({ groupId }, true);

  const removeFromAll = [];
  removeDBData(oldLayout, groupId, MACList);

  MACList.forEach(MAC => {
    if (deviceIntegration.default.getGroupsByMACAddress(MAC).length === 1) {
      removeFromAll.push(MAC);
    }
  });

  const allDeviceLayout = apiCore.db.getUserLayouts({ groupId: 0 }, true);
  removeDBData(allDeviceLayout, 0, removeFromAll);

  if (isDeleteGroup && currentGroupId === groupId) {
    currentGroupId = 0;
  }
};

const removeDBData = (oldLayout, groupId, removeMACs) => {
  const newNode = {};
  const newEdge = {};

  oldLayout.nodes.forEach(node => {
    if (!removeMACs.includes(node.name)) {
      newNode[node.name] = { x: node.x, y: node.y };
    }
  });

  oldLayout.edges.forEach(edge => {
    const [target1, target2] = edge.link.split('_');
    if (!removeMACs.includes(target1) && !removeMACs.includes(target2)) {
      newEdge[edge.link] = {
        leftPort: edge.portName,
        rightPort: edge.remotePortName,
      };
    }
  });

  topologyManagement.default.updateDBLayout({
    currentGroup: groupId,
    positions: newNode,
    edgesData: newEdge,
  });
};

export const updateUserLayout = newLayout => {
  topologyUserLayout = newLayout;
  userUpdate = true;
};

ipcMain.on(REQUEST_MP_SWITCH_POLLING_TOPOLOGY, (event, arg) => {
  console.log(`Topology turn ${!isStartPolling ? 'on' : 'off'}`);
  ({ isStartPolling } = arg);
});

ipcMain.on(REQUEST_MP_TOPOLOGY_SET_CURRENT_GROUP, (event, arg) => {
  currentGroupId = arg.groupId;
  topologyUserLayout = apiCore.db.getUserLayouts(
    { groupId: currentGroupId },
    true,
  );
  userUpdate = true;
  //console.log(topologyUserLayout);
});

export default start;

/* Layout format */
// { nodes:
//   [ { id: 7, name: '00:60:E9:1A:3C:D0', groupId: 0, x: -156, y: 2 },
//     { id: 8, name: '00:60:E9:1A:3C:DF', groupId: 0, x: 160, y: -31 } ],
//  edges:
//   [ { id: 3,
//       link: '00:60:E9:1A:3C:D0_00:60:E9:1A:3C:DF_port3_port3',
//       portName: 'port3',
//       groupId: 0,
//       remotePortName: 'port3' } ] }
