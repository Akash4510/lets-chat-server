const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');
const crypto = require('crypto');

const User = require('../models/user');
const filterObject = require('../utils/filterObject');
const { promisify } = require('util');

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET);
};

exports.register = async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  const filteredBody = filterObject(
    req.body,
    'firstName',
    'lastName',
    'email',
    'password'
  );

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide all required fields!',
    });
  }

  const existingUser = await User.findOne({ email: email });

  if (existingUser && existingUser.verified) {
    return res.status(400).json({
      status: 'fail',
      message: 'User with this email already exists!',
    });
  } else if (existingUser && !existingUser.verified) {
    await User.findOneAndUpdate({ email: email }, filteredBody, {
      new: true,
      validateModifyOnly: true,
      runValidators: true,
    });

    req.userId = existingUser._id;
    next();
  } else {
    const newUser = await User.create(filteredBody);

    req.userId = newUser._id;
    next();
  }
};

exports.sendOtp = async (req, res, next) => {
  const { userId } = req.body;

  // Generating a new otp
  const newOtp = otpGenerator.generate(6, {
    upperCase: false,
    specialChars: false,
    alphabets: false,
  });

  // Setting the expiry time for the otp
  const otpExpireMins = 10;
  const otpEntryTime = Date.now() + otpExpireMins * 60 * 1000;

  // Updating the user document with the new otp and expiry time
  await User.findByIdAndUpdate(userId, {
    otp: newOtp,
    otpExpiryTime: otpEntryTime,
  });

  // TODO: Sending the otp to the user's email

  res.status(200).json({
    status: 'success',
    message: 'OTP sent successfully',
  });
};

exports.verifyOtp = async (req, res, next) => {
  const { email, otp } = req.body;

  const user = await User.findOne({
    email: email,
    otpExpiryTime: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'User not found',
    });
  }

  if (!(await user.correctOtp(otp, user.otp))) {
    res.status(400).json({
      status: 'fail',
      message: 'The OTP you entered is incorrect',
    });
  }

  user.verified = true;
  user.otp = undefined;
  user.otpExpiryTime = undefined;

  await user.save({ new: true, validateModifyOnly: true, runValidators: true });

  const token = signToken(user._id);

  res.status(200).json({
    status: 'success',
    message: 'User verified successfully',
    token,
  });
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide email and password!',
    });
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email: email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: 'fail',
      message: 'Incorrect email or password',
    });
  }

  // 3) If everything ok, send token to client
  const token = signToken();

  res.status(200).json({
    status: 'success',
    message: 'Logged in successfully',
    token,
  });
};

exports.protect = async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  } else {
    return res.status(401).json({
      status: 'fail',
      message: 'You are not logged in! Please log in to get access.',
    });
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const freshUser = await User.findById(decoded.id);

  if (!freshUser) {
    return res.status(401).json({
      status: 'fail',
      message: 'The user belonging to this token does no longer exist.',
    });
  }

  // 4) Check if user changed password after the token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      status: 'fail',
      message: 'User recently changed password! Please log in again.',
    });
  }

  req.user = this_user;
  next();
};

exports.fogrgotPassword = async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'User not found',
    });
  }

  const resetToken = user.createPasswordResetToken();
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/auth/reset-password/?code=${resetToken}`;

  try {
    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(500).json({
      status: 'fail',
      message: 'There was an error sending the email. Try again later!',
    });
  }
};

exports.resetPassword = async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'Token is invalid or has expired',
    });
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // 3) Update changedPasswordAt property for the user
  user.passwordChangedAt = Date.now() - 1000;

  // 4) Log the user in, send JWT
  const token = signToken(user._id);

  res.status(200).json({
    status: 'success',
    message: 'Password reset successfully',
    token,
  });
};
