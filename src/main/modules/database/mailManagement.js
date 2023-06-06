import { ipcMain } from 'electron';
import { apiCore, mailer } from '..';
import {
  REQUEST_MP_GET_MAIL_SETTINGS,
  RESPONSE_RP_GET_MAIL_SETTINGS,
  REQUEST_MP_SET_MAIL_SETTINGS,
  RESPONSE_RP_SET_MAIL_SETTINGS,
} from '../../utils/IPCEvents';

const mailSupportList = [
  '126',
  '163',
  '1und1',
  'AOL',
  'DebugMail',
  'DynectEmail',
  'FastMail',
  'GandiMail',
  'Gmail',
  'Godaddy',
  'GodaddyAsia',
  'GodaddyEurope',
  'hot.ee',
  'Hotmail',
  'iCloud',
  'mail.ee',
  'Mail.ru',
  'Maildev',
  'Mailgun',
  'Mailjet',
  'Mailosaur',
  'Mandrill',
  'Naver',
  'OpenMailBox',
  'Outlook365',
  'Postmark',
  'QQ',
  'QQex',
  'SendCloud',
  'SendGrid',
  'SendinBlue',
  'SendPulse',
  'SES',
  'SES-US-EAST-1',
  'SES-US-WEST-2',
  'SES-EU-WEST-1',
  'Sparkpost',
  'Yahoo',
  'Yandex',
  'Zoho',
  'qiye.aliyun',
];

function getMailSettings() {
  try {
    return {
      success: true,
      msg: 'Get mail settings successful',
      data: apiCore.db.getMailSettings({}, true),
    };
  } catch (error) {
    return { success: false, msg: 'Error in - get mail settings error' };
  }
}

function sendOfflineMail(data) {
  console.log('Mail Server: Send offline mail.');
  try {
    const mailSettings = getMailSettings();
    if (!mailSettings.success) {
      return { success: false, msg: 'Error in - get mail settings fail' };
    }
    if (!mailSettings.data.isOpen) {
      return;
    }

    const mailData = {};
    mailData.service = mailSettings.data.service;
    mailData.host =
      mailSettings.data.service === 'Other'
        ? mailSettings.data.host
        : undefined;
    mailData.port =
      mailSettings.data.service === 'Other'
        ? mailSettings.data.port
        : undefined;
    mailData.username = mailSettings.data.username;
    mailData.password = mailSettings.data.password;
    mailData.to = mailSettings.data.to;
    mailData.cc =
      mailSettings.data.cc !== '' ? mailSettings.data.cc : undefined;
    mailData.bcc =
      mailSettings.data.bcc !== '' ? mailSettings.data.bcc : undefined;
    mailData.subject = `NMU Notification - There are something wrong with ${
      Object.keys(data).length
    } device(s)`;
    mailData.html = `<h1>Warning</h1><p>There are something wrong with ${
      Object.keys(data).length
    } device(s), detail:</p>`;

    Object.keys(data).forEach(MACAddress => {
      mailData.html += `<p>model: ${data[MACAddress].model}, IP: ${data[MACAddress].IPAddress}, MAC Address: ${MACAddress}`;

      switch (data[MACAddress].deviceType) {
        case 'gwd':
          if (data[MACAddress].hasDisable.includes('gwd')) {
            mailData.html +=
              ', device basic unreachable, device is currently offline.';
          }
          break;
        case 'snmp':
          if (data[MACAddress].hasDisable.includes('snmp')) {
            mailData.html +=
              ', device SNMP unreachable, device is currently offline.';
          }
          break;
        case 'all':
          if (data[MACAddress].hasDisable.includes('gwd')) {
            mailData.html += ', device basic unreachable';
          }

          if (data[MACAddress].hasDisable.includes('snmp')) {
            mailData.html += ', device SNMP unreachable';
          }

          if (
            data[MACAddress].hasDisable.includes('gwd') &&
            data[MACAddress].hasDisable.includes('snmp')
          ) {
            mailData.html += ', device is currently offline.';
          }
          break;
        default:
          mailData.html += ', device is currently offline.';
          break;
      }
      mailData.html += '</p>';
    });
    mailer.default.sendMail(mailData);
  } catch (error) {
    console.error(error);
    return { success: false, msg: 'Error in - send mail error' };
  }
}

export default { sendOfflineMail };

ipcMain.on(REQUEST_MP_GET_MAIL_SETTINGS, event => {
  const eventName = RESPONSE_RP_GET_MAIL_SETTINGS;
  try {
    const mailSettings = getMailSettings();

    if (mailSettings.success) {
      mailSettings.data.serviceList = mailSupportList;
      // delete mailSettings.data.pass;

      event.sender.send(eventName, {
        success: true,
        msg: 'Get mail settings successful',
        data: mailSettings.data,
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - get mail settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - get mail settings error',
    });
  }
});

ipcMain.on(REQUEST_MP_SET_MAIL_SETTINGS, (event, arg) => {
  const eventName = RESPONSE_RP_SET_MAIL_SETTINGS;
  try {
    if (arg === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found data' });
      return;
    }
    if (arg.isOpen === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found isOpen' });
      return;
    }
    if (arg.service === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found service',
      });
      return;
    }
    if (
      arg.service === 'Other' &&
      arg.host === undefined &&
      arg.port === undefined
    ) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found host/port',
      });
      return;
    }
    if (arg.username === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found username',
      });
      return;
    }
    if (arg.password === undefined) {
      event.sender.send(eventName, {
        success: false,
        msg: 'Not found password',
      });
      return;
    }
    if (arg.to === undefined) {
      event.sender.send(eventName, { success: false, msg: 'Not found to' });
      return;
    }

    const mailSettings = {
      isOpen: typeof arg.isOpen === 'boolean' ? arg.isOpen : false,
      service: arg.service,
      host: arg.service === 'Other' ? arg.host : '',
      port: arg.service === 'Other' ? arg.port : '',
      username: arg.username,
      password: arg.password,
      to: arg.to,
      cc: arg.cc !== undefined ? arg.cc : '',
      bcc: arg.bcc !== undefined ? arg.bcc : '',
    };

    const success = apiCore.db.setMailSettings(mailSettings, true);
    if (success) {
      event.sender.send(eventName, {
        success: true,
        msg: 'Set mail settings successful',
      });
    } else {
      event.sender.send(eventName, {
        success: false,
        msg: 'Error in - set mail settings fail',
      });
    }
  } catch (error) {
    console.error(error);
    event.sender.send(eventName, {
      success: false,
      msg: 'Error in - set mail settings error',
    });
  }
});
