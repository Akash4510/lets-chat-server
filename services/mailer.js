const nodemailer = require('nodemailer');

exports.sendEmail = async ({ to, subject, html }) => {
  return new Promise(async (resolve, reject) => {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      html,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return reject(error);
      }
      return resolve(info);
    });
  });
};
