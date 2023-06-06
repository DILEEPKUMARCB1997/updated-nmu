/* apiCore Module */

import edge from 'electron-edge-js';

// const dllPath = process.env.NODE_ENV === 'development'
//   ? process.cwd() + '/resources/apiCore.dll'
//   : path.resolve(app.getAppPath(), '../../') + '/resources/apiCore.dll';

const dllPath = './resources/apiCore.dll';

const tmpMethod = {
  // Parser packet
  getModelInfo: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.MonitoringProtocol',
    methodName: 'GetModelInfo',
  }),
  // Parser ack packet
  getAckModelInfo: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.MonitoringProtocol',
    methodName: 'GetAckModelInfo',
  }),
  // Get invite packet
  getInvitePacket: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.MonitoringProtocol',
    methodName: 'GetInvitePacket',
  }),
  // Get network setting packet
  getConfigPacket: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.MonitoringProtocol',
    methodName: 'GetConfigPacket',
  }),
  // Get reboot packet
  getRebootPacket: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.MonitoringProtocol',
    methodName: 'GetRebootPacket',
  }),
  // Get Beep packet
  getBeepPacket: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.MonitoringProtocol',
    methodName: 'GetBeepPacket',
  }),
  // Get Download request
  getDownloadRequest: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.MonitoringProtocol',
    methodName: 'GetDownloadRequest',
  }),
  // checksum
  calculateChecksum: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.Authentication',
    methodName: 'CalculateChecksum',
  }),
};

const tmpDb = {
  // database exists
  tableExists: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.SqlExtensions',
    methodName: 'TableExists',
  }),
  // database exists
  isDbExists: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.SqlExtensions',
    methodName: 'IsDbExists',
  }),
  // group management
  getGroupData: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.GroupManagement',
    methodName: 'GetGroupData',
  }),
  addGroup: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.GroupManagement',
    methodName: 'AddGroup',
  }),
  // Schedule management
  getScheduleData: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.ScheduleBackupManagement',
    methodName: 'GetScheduledData',
  }),
  // Users Data
  getUsersData: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.UserDetailsManagement',
    methodName: 'GetAllUsers',
  }),

  // Registered event Data
  getAllRegisteredEventData: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.RegisterEventManagement',
    methodName: 'GetAllRegisteredEventData',
  }),

  // enable/disable Registered event Data
  enableRegisteredEventData: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.RegisterEventManagement',
    methodName: 'enableRegisteredEventData',
  }),

  addScheduleBackup: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.ScheduleBackupManagement',
    methodName: 'AddScheduleBackup',
  }),
  addScheduleDevice: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.ScheduleBackupManagement',
    methodName: 'AddRemoveDevice',
  }),
  deleteSchedule: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.ScheduleBackupManagement',
    methodName: 'DeleteSchedule',
  }),
  updateScheduleDeviceStatus: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.ScheduleBackupManagement',
    methodName: 'UpdateDeviceScheduleStatus',
  }),
  renameGroup: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.GroupManagement',
    methodName: 'RenameGroup',
  }),
  deleteGroup: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.GroupManagement',
    methodName: 'DeleteGroup',
  }),
  updateDevice: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.GroupManagement',
    methodName: 'updateDevice',
  }),
  addRemoveDevice: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.GroupManagement',
    methodName: 'AddRemoveDevice',
  }),
  // netwrok interface management
  getIFace: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.IFaceManagement',
    methodName: 'GetIFace',
  }),
  getCurrentIFace: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.IFaceManagement',
    methodName: 'GetCurrentNetworkInterface',
  }),
  getLoginDetails: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.UserDetailsManagement',
    methodName: 'GetLoginDetail',
  }),

  // save register event data
  insertRegisterEvent: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.RegisterEventManagement',
    methodName: 'InsertRegisterEvent',
  }),

  // Delete register event
  DeleteRegisterEvent: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.RegisterEventManagement',
    methodName: 'DeleteRegisteredEventData',
  }),

  // update register event Notification
  UpdateRegisteredEventNotification: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.RegisterEventManagement',
    methodName: 'UpdateRegisteredEventNotification',
  }),

  // update register event Notification
  UpdateRegisteredNotificationType: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.RegisterEventManagement',
    methodName: 'UpdateRegisteredNotificationType',
  }),

  // save users data
  SaveUserData: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.UserDetailsManagement',
    methodName: 'SaveUserData',
  }),
  // delete users data
  DeleteUser: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.UserDetailsManagement',
    methodName: 'DeleteUser',
  }),
  setIFace: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.IFaceManagement',
    methodName: 'SetNetworkInterface',
  }),
  // mail settings
  getMailSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.MailManagement',
    methodName: 'GetMailSettings',
  }),
  setMailSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.MailManagement',
    methodName: 'SetMailSettings',
  }),
  // Notification settings
  GetGlobalNotificationSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.NotificationsManagement',
    methodName: 'GetGlobalNotificationSettings',
  }),
  SaveGlobalNotification: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.NotificationsManagement',
    methodName: 'saveGlobalNotification',
  }),
  // Group sort list settings
  GetGroupSortList: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.GroupListSortManagement',
    methodName: 'GetGroupSortList',
  }),
  saveGroupSortList: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.GroupListSortManagement',
    methodName: 'saveGroupSortList',
  }),

  // telegram settings
  GetTelegramToken: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.TelegramManagemant',
    methodName: 'GetTelegramToken',
  }),
  saveTelegramToken: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.TelegramManagemant',
    methodName: 'saveTelegramToken',
  }),
  // telegram user settings
  saveTelegramUser: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.TelegramManagemant',
    methodName: 'saveTelegramUser',
  }),
  getAllTelegramUser: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.TelegramManagemant',
    methodName: 'getAllTelegramUser',
  }),
  deleteTelegramUser: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.TelegramManagemant',
    methodName: 'deleteTelegramUser',
  }),
  // IP range settings
  setIPRange: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.IPRangeManagement',
    methodName: 'SetIPRange',
  }),
  getIPRange: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.IPRangeManagement',
    methodName: 'GetIPRange',
  }),
  // SNMP settings
  setSnmpSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.SnmpManagement',
    methodName: 'SetSnmpSettings',
  }),
  getSnmpSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.SnmpManagement',
    methodName: 'GetSnmpSettings',
  }),
  //Device scan management
  getIsFixedIp: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.DeviceScanManagement',
    methodName: 'GetIsFixedIp',
  }),
  getAllDeviceScan: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.DeviceScanManagement',
    methodName: 'GetAllDeviceScan',
  }),
  getDeviceScanByMAC: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.DeviceScanManagement',
    methodName: 'GetDeviceScanByMAC',
  }),
  // Advanced settings
  getSNMPInitialData: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.SnmpManagement',
    methodName: 'GetSNMPInitialData',
  }),
  setAdvancedSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.AdvancedManagement',
    methodName: 'SetAdvancedSettings',
  }),
  getAdvancedSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.AdvancedManagement',
    methodName: 'GetAdvancedSettings',
  }), // DeviceCommunity
  getDeviceCommunity: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.DeviceCommunityManagement',
    methodName: 'GetDeviceCommunity',
  }),
  getDeviceCommSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.DeviceCommunityManagement',
    methodName: 'GetDeviceCommSettings',
  }),
  setDeviceCommSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.DeviceCommunityManagement',
    methodName: 'SetDeviceCommSettings',
  }), // DeviceAuthentication
  getDeviceAuthSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.DeviceAuthManagement',
    methodName: 'GetDeviceAuthSettings',
  }),
  setDeviceAuthSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.DeviceAuthManagement',
    methodName: 'SetDeviceAuthSettings',
  }), // Event log
  updateEvent: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.EventLogManagement',
    methodName: 'UpdateEvent',
  }),
  updateTrap: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.EventLogManagement',
    methodName: 'UpdateTrap',
  }),
  // update custom event logging
  UpdateCustomEventLog: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.CustomEventManagement',
    methodName: 'UpdateCustomEventLog',
  }),
  getEventData: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.EventLogManagement',
    methodName: 'GetEventData',
  }),
  updateSyslog: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.EventLogManagement',
    methodName: 'UpdateSyslog',
  }),
  getLastEventLogByMACAddress: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.EventLogManagement',
    methodName: 'GetLastEventLogByMACAddress',
  }),
  getEventLogByType: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.EventLogManagement',
    methodName: 'GetEventLogByType',
  }),
  getDeviceAlarmSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.AlarmManagement',
    methodName: 'GetDeviceAlarmSettings',
  }),
  setDeviceAlarmSettings: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.AlarmManagement',
    methodName: 'SetDeviceAlarmSettings',
  }),
  updateTopologyLayout: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.TopologyManagement',
    methodName: 'UpdateTopologyLayout',
  }),
  getUserLayouts: edge.func({
    assemblyFile: dllPath,
    typeName: 'apiCore.DBService.TopologyManagement',
    methodName: 'GetUserLayouts',
  }),
};

export const method = tmpMethod;
export const db = tmpDb;
