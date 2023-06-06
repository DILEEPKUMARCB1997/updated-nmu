/* group management module */
import { ipcMain } from 'electron';
import async from 'async';
import _ from 'lodash';
import { deviceIntegration, queueManagement, apiCore, topology } from '..';
import {
  REQUEST_MP_GROUP_MEMBER_CHANGE,
  REQUEST_MP_SET_THE_GROUP_DATA,
  RESPONSE_RP_SET_THE_GROUP_DATA,
} from '../../utils/IPCEvents';

function killQueue() {
  try {
    groupManagmentQueue.kill();
    groupChangeQueue.kill();
  } catch (error) {
    console.error(error);
  }
}

function updateModelInfo(data) {
  try {
    apiCore.db.updateDevice(data.device, true);
  } catch (error) {
    console.error(error);
  }
}

function getGroupData() {
  try {
    const groupData = JSON.parse(apiCore.db.getGroupData({}, true));
    return { success: true, msg: 'Get group data successful', data: groupData };
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - get group data fail' };
  }
}
export default { killQueue, updateModelInfo, getGroupData };

const groupManagmentQueue = async.queue((temp, callback) => {
  const tmp = temp;
  try {
    switch (tmp.cmd) {
      // create new group
      case 'addGroup': {
        if (tmp.groupName === undefined) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Not found groupName',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }

        const result = apiCore.db.addGroup({ groupName: tmp.groupName }, true);
        if (result == null) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Error in - add group fail',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }
        if (!result.success) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Error in - add group fail',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }

        tmp.groupId = result.identity;
        break;
      }
      // update group name
      case 'renameGroup': {
        if (tmp.groupId === undefined) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Not found groupId',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }
        if (tmp.groupName === undefined) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Not found groupName',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }

        if (
          !apiCore.db.renameGroup(
            { groupId: tmp.groupId, groupName: tmp.groupName },
            true,
          )
        ) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Error in  - rename group fail',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }
        break;
      }
      // delete group
      case 'deleteGroup': {
        if (tmp.groupId === undefined) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Not found groupId',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }
        if (!apiCore.db.deleteGroup({ groupId: tmp.groupId }, true)) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Error in - delete group fail',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }
        const { groupId } = tmp;
        const deviceList = Object.keys(
          deviceIntegration.default.getDeviceGroupList()[groupId].deviceList,
        );
        topology.layoutRemoveNodes(groupId, deviceList, true);

        break;
      }
      // add/remove device to group
      case 'addRemoveDevice': {
        if (tmp.groupId === undefined) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Not found groupId',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }
        if (tmp.MACAddressList === undefined) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Not found MACAddressList',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }

        // get deviceGroupList from main
        const deviceGroupListCopy = deviceIntegration.default.getDeviceGroupList();

        if (deviceGroupListCopy[tmp.groupId] === undefined) {
          tmp.event.sender.send(tmp.eventName, {
            success: false,
            msg: 'Not found groupId',
            data: { cmd: tmp.cmd },
          });
          callback();
          return;
        }

        // get this group data
        const groupData = _.cloneDeep(deviceGroupListCopy[tmp.groupId]);
        const modifyGroupList = {
          groupId: tmp.groupId,
          addDeviceList: {},
          removeDeviceList: [],
        };

        // add device to addDeviceList
        tmp.MACAddressList.forEach(element => {
          if (groupData.deviceList[element] !== undefined) {
            delete groupData.deviceList[element];
          } else if (groupData[element] === undefined) {
            // find the model info from all
            let isDeviceExist = false;
            Object.keys(deviceGroupListCopy).every(groupId => {
              if (
                deviceGroupListCopy[groupId].deviceList[element] !== undefined
              ) {
                modifyGroupList.addDeviceList[element] = {
                  model: deviceGroupListCopy[groupId].deviceList[element].model,
                  MACAddress:
                    deviceGroupListCopy[groupId].deviceList[element].MACAddress,
                  IPAddress:
                    deviceGroupListCopy[groupId].deviceList[element].IPAddress,
                  netmask:
                    deviceGroupListCopy[groupId].deviceList[element].netmask,
                  gateway:
                    deviceGroupListCopy[groupId].deviceList[element].gateway,
                  hostname:
                    deviceGroupListCopy[groupId].deviceList[element].hostname,
                  kernel:
                    deviceGroupListCopy[groupId].deviceList[element].kernel,
                  ap: deviceGroupListCopy[groupId].deviceList[element].ap,
                  online:
                    deviceGroupListCopy[groupId].deviceList[element].online,
                  isDHCP:
                    deviceGroupListCopy[groupId].deviceList[element].isDHCP,
                  deviceType:
                    deviceGroupListCopy[groupId].deviceList[element].deviceType,
                };
                isDeviceExist = true;
                return false;
              }
              return true;
            });
            if (!isDeviceExist) {
              modifyGroupList.addDeviceList[element] = {
                model: '',
                MACAddress: element,
                IPAddress: '',
                netmask: '',
                gateway: '',
                hostname: '',
                kernel: '',
                ap: '',
                online: false,
                isDHCP: false,
                deviceType: 'gwd',
              };
            }
          }
        });

        // remove device to removeDeviceList
        /* modifyGroupList */
        //  {
        //   groupId: '2',
        //   addDeviceList: {
        //     '00:60:E9:0B:09:68': {
        //       model: 'EH7510-2Fm',
        //       MACAddress: '00:60:E9:0B:09:68',
        //       IPAddress: '192.168.6.144',
        //       netmask: '255.255.255.0',
        //       gateway: '192.168.6.254',
        //       hostname: 'EH7510',
        //       kernel: '1.25',
        //       ap: 'Application: V1.35',
        //       online: true,
        //       isDHCP: false,
        //       deviceType: 'gwd',
        //     },
        //   },
        //   removeDeviceList: [],
        // };
        Object.keys(groupData.deviceList).forEach(MACAddress => {
          modifyGroupList.removeDeviceList.push(MACAddress);
        });

        topology.layoutRemoveNodes(
          modifyGroupList.groupId,
          modifyGroupList.removeDeviceList,
          false,
        );
        if (
          Object.keys(modifyGroupList.addDeviceList).length !== 0 ||
          modifyGroupList.removeDeviceList.length !== 0
        ) {
          if (!apiCore.db.addRemoveDevice(modifyGroupList, true)) {
            tmp.event.sender.send(tmp.eventName, {
              success: false,
              msg: 'Error in - add/remove device to group fail',
              data: { cmd: tmp.cmd },
            });
            callback();
            return;
          }
        }

        tmp.modifyGroupList = _.cloneDeep(modifyGroupList);
        break;
      }
      // Invalid cmd
      default: {
        tmp.event.sender.send(tmp.eventName, {
          success: false,
          msg: 'Invalid cmd',
          data: { cmd: tmp.cmd },
        });
        callback();
        return;
      }
    }
    // callback to group taskqueue
    tmp.callbackfn = callback;
    deviceIntegration.default.updateDeviceGroupList(tmp);
  } catch (error) {
    console.error(error);
    tmp.event.sender.send(tmp.eventName, {
      success: false,
      msg: 'Error in - set group data error',
      data: { cmd: tmp.cmd },
    });
    callback();
  }
}, 1);

ipcMain.on(REQUEST_MP_SET_THE_GROUP_DATA, (event, arg) => {
  const eventName = RESPONSE_RP_SET_THE_GROUP_DATA;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.cmd === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Invalid cmd' });
    }

    const temp = arg;
    temp.event = event;
    temp.eventName = eventName;

    queueManagement.default.add(groupManagmentQueue, temp);
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set the group data error',
    });
  }
});

ipcMain.on(REQUEST_MP_GROUP_MEMBER_CHANGE, (event, arg) => {
  try {
    const newDeviceData = {
      model: '',
      IPAddress: '',
      netmask: '',
      gateway: '',
      hostname: '',
      kernel: '',
      ap: '',
      online: false,
      isDHCP: false,
      deviceType: 'gwd',
    };
    const { changeGroupMemberData } = arg;
    const { addDevice, removeDevice } = changeGroupMemberData;

    const data = {};

    Object.entries(addDevice).forEach(([MACAddress, groupIds]) => {
      groupIds.forEach(groupId => {
        if (data[groupId] === undefined) {
          data[groupId] = {
            groupId,
            removeDeviceList: [],
            addDeviceList: {
              [MACAddress]: {
                MACAddress,
                ...newDeviceData,
              },
            },
          };
        } else {
          data[groupId].addDeviceList.push({
            [MACAddress]: {
              MACAddress,
              ...newDeviceData,
            },
          });
        }
      });
    });

    removeDevice.forEach(MACAddress => {
      deviceIntegration.default
        .getGroupsByMACAddress(MACAddress)
        .forEach(groupId => {
          if (data[groupId] === undefined) {
            data[groupId] = {
              groupId,
              addDeviceList: {},
              removeDeviceList: [MACAddress],
            };
          } else {
            data[groupId].removeDeviceList.push(MACAddress);
          }
        });
    });

    Object.values(data).forEach(element => {
      queueManagement.default.add(groupChangeQueue, element);
    });
  } catch (error) {
    console.error(error);
  }
});

const groupChangeQueue = async.queue((temp, callback) => {
  try {
    const updateGroupData = {
      groupId: temp.groupId,
      cmd: 'addRemoveDevice',
      modifyGroupList: { ...temp },
      callbackfn: callback,
    };
    if (
      Object.keys(temp.addDeviceList).length !== 0 ||
      temp.removeDeviceList.length !== 0
    ) {
      apiCore.db.addRemoveDevice(temp, true);
    }

    deviceIntegration.default.updateDeviceGroupList(updateGroupData);
  } catch (err) {
    console.error(err);
  }
});
