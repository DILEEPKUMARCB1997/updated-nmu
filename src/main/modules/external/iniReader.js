import ini from 'ini';
import fs from 'fs';

const defaultConfig = {
  firmwareUpdate: {
    writeFlashTime: 480, // sec
  },
  systemInit: {
    checkOfflineTime: 1000, // ms
  }
};

function iniInitialize() {
  try {
    if (!fs.existsSync('./config.ini')) {
      fs.writeFileSync('./config.ini', ini.stringify(defaultConfig));
    }
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

function getConfig() {
  try {
    const tmpConfig = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
    const config = {
      firmwareUpdate: {
        writeFlashTime: /^\d+$/.test(tmpConfig.firmwareUpdate.writeFlashTime)
          ? tmpConfig.firmwareUpdate.writeFlashTime
          : defaultConfig.firmwareUpdate.writeFlashTime,
      },
      systemInit: {
        checkOfflineTime: /^\d+$/.test(tmpConfig.systemInit.checkOfflineTime)
          ? tmpConfig.systemInit.checkOfflineTime
          : defaultConfig.systemInit.checkOfflineTime,
      }
    };
    return config;
  } catch (error) {
    fs.writeFileSync('./config.ini', ini.stringify(defaultConfig));
    return defaultConfig;
  }
}
export default { iniInitialize, getConfig };
