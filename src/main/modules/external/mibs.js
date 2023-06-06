const mib = {
  supportOid: [
    '1.3.6.1.4.1.3755.0.0.14', //  eh7506
    '1.3.6.1.4.1.3755.0.0.23', // eh7508
    '1.3.6.1.4.1.3755.0.0.15', //  eh7512
    '1.3.6.1.4.1.3755.0.0.21', //  eh7520, ehg750x
    '1.3.6.1.4.1.3755.0.0.22', //  rh7728
    '1.3.6.1.4.1.3755.0.0.24', //  eh1504, eh7504
    '1.3.6.1.4.1.3755.0.0.26', //  rh7528
    '1.3.6.1.4.1.3755.0.0.31', //  ehg760x L2
    '1.3.6.1.4.1.3755.0.0.33', //  ehg760x L3
    '1.3.6.1.4.1.3755.0.0.60', //EHG3408
    '1.3.6.1.4.1.3755.0.0.2033', //  ehg760x L3
    '1.3.6.1.4.1.3755.0.0.2031', //  ehg760x L3
    '1.3.6.1.4.1.3755.0.0.2015', //  ehg760x L3
    '1.3.6.1.4.1.11317.0.0.31', // Wieland L2MS 4G/8G
    '1.3.6.1.4.1.11317.0.0.14', // Wieland L2MS 06
    '1.3.6.1.4.1.11317.0.0.23', // Wieland L2MS 08
    '1.3.6.1.4.1.11317.0.0.15', // Wieland L2MS 12
    '1.3.6.1.4.1.11317.0.0.21', // Wieland L2MS 20
    '1.3.6.1.4.1.54555.0.275.33', //  YARUS L3
    '1.3.6.1.4.1.13576.7.5002.1', //wago 2408
    '1.3.6.1.4.1.13576.7.5001.1', //wago 2408
  ],
  public: {
    system: {
      sysDescr: '1.3.6.1.2.1.1.1.0',
      sysObjectId: '1.3.6.1.2.1.1.2.0',
      sysUpTime: '1.3.6.1.2.1.1.3.0',
      sysContact: '1.3.6.1.2.1.1.4.0',
      sysName: '1.3.6.1.2.1.1.5.0',
      sysLocation: '1.3.6.1.2.1.1.6.0',
      sysServices: '1.3.6.1.2.1.1.7.0',
    },
    interfaces: {
      ifIndex: '1.3.6.1.2.1.2.2.1.1', // get port name
      ifDescr: '1.3.6.1.2.1.2.2.1.2', // get port name
      ifPhysAddress: '1.3.6.1.2.1.2.2.1.6', // get MAC address
      ifAdminStatus: '1.3.6.1.2.1.2.2.1.7', // set/get port enable/disable
      ifOperStatus: '1.3.6.1.2.1.2.2.1.8', // get port status
      ifInNUcastPkts: '1.3.6.1.2.1.2.2.1.12', // ifInMulticastPkts + ifInBroadcastPkts
      ifInErrors: '1.3.6.1.2.1.2.2.1.14',
      ifOutNUcastPkts: '1.3.6.1.2.1.2.2.1.18', // ifOutMulticastPkts + ifOutBroadcastPkts
      ifOutErrors: '1.3.6.1.2.1.2.2.1.20',
      ifHCInOctets: '1.3.6.1.2.1.31.1.1.1.6',
      //ifHCInOctets: '1.3.6.1.2.1.2.2.1.10', //temp
      ifHCInUcastPkts: '1.3.6.1.2.1.31.1.1.1.7',
      ifHCInMulticastPkts: '1.3.6.1.2.1.31.1.1.1.8',
      ifHCInBroadcastPkts: '1.3.6.1.2.1.31.1.1.1.9',
      ifHCOutOctets: '1.3.6.1.2.1.31.1.1.1.10',
      //ifHCOutOctets: '1.3.6.1.2.1.2.2.1.16', //temp
      ifHCOutUcastPkts: '1.3.6.1.2.1.31.1.1.1.11',
      ifHCOutMulticastPkts: '1.3.6.1.2.1.31.1.1.1.12',
      ifHCOutBroadcastPkts: '1.3.6.1.2.1.31.1.1.1.13',
      ifHighSpeed: '1.3.6.1.2.1.31.1.1.1.15', // get port speed
    },
    ifMIB: {
      ifAlias: '1.3.6.1.2.1.31.1.1.1.18',
    },
  },
  private: {
    systemInfo: {
      systemDescr: '.1.4.0',
      systemFwVer: '.1.5.0',
      systemMacAddress: '.1.6.0',
      systemKernelVer: '.1.7.0',
      powerInfo: {
        powerInfoNumber: '.1.9.1.1.1',
        powerInfoStatus: '.1.9.1.1.2',
      },
      systemModel: '.1.10.0',
    },
    syslogSetting: {
      syslogStatus: '.10.1.2.1.0',
      serverPort: '.10.1.2.3.0',
      eventServerLevel: '.10.1.2.4.0',
      eventLogToFlash: '.10.1.2.5.0',
      eventServerIP: '.10.1.2.6.0',
    },
    trapSetting: {
      snmpTrapServerStatus: '.8.6.1.5.0',
      snmpTrapServerIP: '.8.6.1.7.0',
      snmpTrapServerPort: '.8.6.1.6.0',
      snmpTrapServerTrapComm: '.8.6.1.3.0',
    },
    basicSetting: {
      ipConfiguration: {
        ipConfigurationDHCPStatus: '.2.3.1.1.2.1',
        ipConfigurationAddress: '.2.3.1.1.3.1',
        ipConfigurationSubMask: '.2.3.1.1.4.1',
        ipConfigurationGateway: '.2.3.1.1.5.1',
        ipConfigurationDNS1: '.2.3.1.1.6.1',
        ipConfigurationDNS2: '.2.3.1.1.7.1',
      },
      backupAndRestore: {
        backupServerIP: '.2.6.1.0',
        backupAgentBoardFwFileName: '.2.6.2.0',
        backupStatus: '.2.6.3.0',
        restoreServerIP: '.2.6.4.0',
        restoreAgentBoardFwFileName: '.2.6.5.0',
        restoreStatus: '.2.6.6.0',
      },
      factoryDefault: {
        factoryDefaultAction: '.2.8.1.0',
      },
      systemReboot: {
        systemRebootAction: '.2.9.1.0',
      },
      saveConfig: {
        saveCfgMgtAction: '.13.1.0',
      },
    },
    portConfiguration: {
      portControl: {
        portStatusPortMode: '.3.1.2.1.3', // get port mode
      },
    },
    diagnosis: {
      locate: {
        locateBeep: '.17.2.1.0',
      },
    },
  },
  lldp: {
    lldpLocChassisId: '1.0.8802.1.1.2.1.3.2',
    lldpRemChassisId: '1.0.8802.1.1.2.1.4.1.1.5', // get self port, remote MAC.
    lldpRemPortId: '1.0.8802.1.1.2.1.4.1.1.7', // get remote port,
  },
  erps: {
    erpsEnabled: '.4.4.1',
    erpsRsapVlan: '.4.4.3.1.1',
    erpsData: '.4.4.3.1',
    erpsWestPortStatus: '.4.4.3.1.4.',
    erpsEastPortStatus: '.4.4.3.1.5.',
    erpsWestPort: '.4.4.3.1.2.',
    erpsEastPort: '.4.4.3.1.3.',
  },
  rstp: {
    rstpEnabled: '.4.2.1',
    rstpPortInfoRole: '.4.3.2.1.8',
    rstpPortInfoStat: '.4.3.2.1.7',
  },
};

function getMib() {
  return mib;
}

export default { getMib };
