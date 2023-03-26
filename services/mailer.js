// const sgMail = require('@sendgrid/mail');
// const dotenv = require('dotenv');

// dotenv.config({ path: './config.env' });

// sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// const sendSGMail = async ({
//   recipient,
//   sender,
//   subject,
//   html,
//   text,
//   attachments,
// }) => {
//   try {
//     const from = sender || process.env.SENDGRID_EMAIL;

//     const msg = {
//       to: recipient,
//       from,
//       subject,
//       html,
//       text,
//       attachments,
//     };

//     return await sgMail.send(msg);
//   } catch (error) {
//     console.log(error);
//   }
// };

exports.sendEmail = async (args) => {
  if (process.env.NODE_ENV === 'development') {
    return new Promise.resolve();
  } else {
    console.log(args);
  }
};
