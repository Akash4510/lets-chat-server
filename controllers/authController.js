const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const crypto = require('crypto');
const mailService = require('../services/mailer');

const User = require('../models/user');
const filterObject = require('../utils/filterObject');
const { promisify } = require('util');
const catchAsync = require('../utils/catchAsync');

const otpHTML = require('../Templates/Mail/otp');
const resetHTML = require('../Templates/Mail/resetPassword');

// Generating a new JWT token
const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);

// Registering a new user
exports.register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  // Filtering the request body to only include the required fields
  const filteredBody = filterObject(
    req.body,
    'firstName',
    'lastName',
    'email',
    'password'
  );

  // Checking if all required fields are present
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide all required fields!',
    });
  }

  // Checking if the user already exists
  const existingUser = await User.findOne({ email: email });

  if (existingUser && existingUser.verified) {
    // If the user already exists and is verified, return an error
    return res.status(400).json({
      status: 'fail',
      message: 'User with this email already exists!',
    });
  } else if (existingUser && !existingUser.verified) {
    // If the user already exists but is not verified, update the user document
    await User.findOneAndUpdate({ email: email }, filteredBody, {
      new: true,
      validateModifyOnly: true,
    });

    // Setting the userId in the request object
    req.userId = existingUser._id;

    // Calling the next middleware
    next();
  } else {
    // If the user does not exist, create a new user document
    const newUser = await User.create(filteredBody);

    // Setting the userId in the request object
    req.userId = newUser._id;

    // Calling the next middleware
    next();
  }
});

// Sending the otp to the user's email
exports.sendOtp = catchAsync(async (req, res, next) => {
  const { userId } = req;

  // Generating a new otp
  const newOtp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });

  // Setting the expiry time for the otp
  const otpExpireMins = 10;
  const otpEntryTime = Date.now() + otpExpireMins * 60 * 1000;

  // Updating the user document with the new otp and expiry time
  const user = await User.findByIdAndUpdate(userId, {
    otpExpiryTime: otpEntryTime,
  });

  // Converting the otp to string and saving it in the user document
  user.otp = newOtp.toString();
  await user.save({ new: true, validateModifiedOnly: true });

  console.log(`OTP for ${user.email} is ${newOtp}`);

  mailService
    .sendEmail({
      to: user.email,
      subject: 'OTP for LetsChat',
      html: otpHTML(user.firstName, newOtp),
    })
    .then(() => {
      console.log('OTP sent successfully');
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

// Verifying the otp entered by the user
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { email, otp } = req.body;
  console.log(email, otp);

  const user = await User.findOne({
    email: email,
    otpExpiryTime: { $gt: Date.now() },
  });

  // Checking if the user exists and the otp is valid
  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'User not found or OTP expired',
    });
  }

  // Checking if the user is already verified
  if (user.verified) {
    return res.status(400).json({
      status: 'fail',
      message: 'Email is already verified',
    });
  }

  // Checking if the otp entered by the user is correct
  if (!(await user.correctOtp(otp, user.otp))) {
    return res.status(400).json({
      status: 'fail',
      message: 'The OTP you entered is incorrect',
    });
  }

  // Updating the user document
  user.verified = true;
  user.otp = undefined;
  user.otpExpiryTime = undefined;

  await user.save({ new: true, validateModifyOnly: true, runValidators: true });

  // Generating a new JWT token
  const token = signToken(user._id);

  res.status(200).json({
    status: 'success',
    message: 'User verified successfully',
    token,
    userId: user._id,
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  });
});

// Logging in the user
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide email and password!',
    });
  }

  // Find user by email and password
  const user = await User.findOne({ email: email }).select('+password');

  // Check if user exists
  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'User does not exist',
    });
  }

  // Check if user is verified
  if (!user.verified) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please verify your email first',
    });
  }

  // Check if user is verified
  if (!(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: 'fail',
      message: 'Incorrect password',
    });
  }

  // If everything ok, send token to client
  const token = signToken(user._id);

  res.status(200).json({
    status: 'success',
    message: 'Logged in successfully',
    token,
    userId: user._id,
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  });
});

// Protecting the routes from unauthorized access
exports.protect = catchAsync(async (req, res, next) => {
  // Getting token and check of it's there
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      status: 'fail',
      message: 'You are not logged in! Please log in to get access.',
    });
  }

  // Verify the token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  console.log(decoded);

  // Check if user still exists (It may happen that the user is deleted after the token is issued)
  const thisUser = await User.findById(decoded.userId);

  // If the user is deleted, then throw an error
  if (!thisUser) {
    return res.staus(401).json({
      status: 'fail',
      message: 'The user belonging to this token does no longer exist.',
    });
  }

  // Check if user changed password after the token was issued
  if (thisUser.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      status: 'fail',
      message: 'User recently changed password! Please log in again.',
    });
  }

  // Store the user in the request object
  req.user = thisUser;

  // Call the next middleware
  next();
});

// Forgot password
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // Get user based on the posted email
  const user = await User.findOne({ email: req.body.email });

  // If user does not exist, then throw an error
  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'User not found',
    });
  }

  // Generate the random reset token and save it in the user's document
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Send the reset token to the user's email
  try {
    const resetURL = `http://localhost:3000/auth/reset-password?token=${resetToken}`;

    console.log(resetURL);

    mailService
      .sendEmail({
        to: user.email,
        subject: 'Password Reset for LetsChat',
        html: resetHTML(user.firstName, resetURL),
      })
      .then(() => {
        console.log('Email sent successfully');
        return res.status(200).json({
          status: 'success',
          message: 'Email sent successfully',
        });
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).json({
          status: 'error',
          message: 'Something went wrong',
        });
      });
  } catch (err) {
    // If there is an error, then reset the passwordResetToken and passwordResetExpires fields
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(500).json({
      status: 'fail',
      message: 'There was an error sending the email. Try again later!',
    });
  }
});

// Resetting the password
exports.resetPassword = catchAsync(async (req, res, next) => {
  // Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.body.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // If token has not expired, and there is user, set the new password
  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'Token is invalid or has expired',
    });
  }

  // Set the new password and save it in the user's document
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  // Update changedPasswordAt property for the user
  user.passwordChangedAt = Date.now() - 1000;
  await user.save();

  // Log the user in, send JWT
  const token = signToken(user._id);

  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully',
    token,
  });
});
