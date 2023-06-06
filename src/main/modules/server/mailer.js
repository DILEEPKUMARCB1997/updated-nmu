/* mailer module */

import nodemailer from 'nodemailer';

async function sendMail(data) {
  try {
    // create reusable transporter object using the default SMTP transport
    //console.log(data);
    const transport = {};
    if (data.service === 'Other') {
      transport.host = data.host;
      transport.port = data.port;
      transport.auth = { user: data.username, pass: data.password };
    } else {
      transport.service = data.service;
      transport.auth = { user: data.username, pass: data.password };
    }
    const transporter = nodemailer.createTransport(transport);

    // setup email data with unicode symbols
    const mailOptions = {};
    mailOptions.from = data.username; // fixed send user is empty
    mailOptions.to = data.to;
    if (data.cc !== undefined) {
      mailOptions.cc = data.cc;
    }
    if (data.bcc !== undefined) {
      mailOptions.bcc = data.bcc;
    }
    mailOptions.subject = data.subject;
    mailOptions.html = data.html;

    // send mail with defined transport object
    await transporter.sendMail(mailOptions, error => {
      if (error) {
        return console.error(error);
      }
      // console.log('Message sent: %s', info.messageId);
      // // Preview only available when sending through an Ethereal account
      // console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    });
  } catch (error) {
    console.error(error);
  }
}
export default { sendMail };
