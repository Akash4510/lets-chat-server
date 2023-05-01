const otpGenerator = require('otp-generator');
const mailService = require('../services/mailer');
const catchAsync = require('../utils/catchAsync');
const otpHTML = require('../Templates/Mail/otp');
const resetHTML = require('../Templates/Mail/resetPassword');

exports.sendOtp = catchAsync(async (req, res, next) => {
  // Generating a new otp
  const newOtp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  otp = newOtp.toString();

  mailService
    .sendEmail({
      to: 'test.email.cr7@gmail.com',
      subject: 'OTP for LetsChat',
      // html: resetHTML('Akash', 'click.me'),
      html: otpHTML('Akash', otp),
    })
    .then(() => {
      console.log('Email sent successfully');
      return res.status(200).json({
        status: 'success',
        message: 'OTP sent successfully',
      });
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).json({
        status: 'error',
        message: 'Something went wrong',
      });
    });
});
