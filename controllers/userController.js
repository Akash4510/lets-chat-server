const User = require('../models/user');
const FriendRequest = require('../models/friendRequest');
const filterObject = require('../utils/filterObject');
const catchAsync = require('../utils/catchAsync');

// const { generateToken04 } = require('./zegoServerAssistant');

// const appID = process.env.ZEGO_APP_ID;
// const serverSecret = process.env.ZEGO_SERVER_SECRET;

exports.getMe = catchAsync(async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: req.user,
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  const { user } = req;

  const filteredBody = filterObject(
    req.body,
    'firstName',
    'lastName',
    'about',
    'avatar'
  );

  const updatedUser = await User.findByIdAndUpdate(user._id, filteredBody, {
    new: true,
    validateModifyOnly: true,
  });

  return res.status(200).json({
    status: 'success',
    data: updatedUser,
    message: 'Profile updated successfully!',
  });
});

exports.getUsers = catchAsync(async (req, res, next) => {
  const allUsers = await User.find({
    verified: true,
  }).select('firstName lastName _id');

  const thisUser = req.user;

  const remainingUsers = allUsers.filter(
    (user) =>
      !thisUser.friends.includes(user._id) &&
      user._id.toString() !== thisUser._id.toString()
  );

  res.status(200).json({
    status: 'success',
    data: remainingUsers,
    message: 'All users fetched successfully!',
  });
});

exports.getAllVerifiedUsers = catchAsync(async (req, res, next) => {
  const allUsers = await User.find({
    verified: true,
  }).select('firstName lastName _id');

  const remainingUsers = allUsers.filter(
    (user) => user._id.toString() !== req.user._id.toString()
  );

  res.status(200).json({
    status: 'success',
    data: remainingUsers,
    message: 'Users found successfully!',
  });
});

exports.getRequests = catchAsync(async (req, res, next) => {
  const requests = await FriendRequest.find({
    receiver: req.user._id,
  }).populate('sender', '_id firstName lastName');

  res.status(200).json({
    status: 'success',
    data: requests,
    message: 'All requests fetched successfully!',
  });
});

exports.getFriends = catchAsync(async (req, res, next) => {
  const thisUser = await User.findById(req.user._id).populate(
    'friends',
    '_id firstName lastName'
  );

  res.status(200).json({
    status: 'success',
    data: thisUser.friends,
    message: 'All friends fetched successfully!',
  });
});
