const User = require('../models/user');
const FriendRequest = require('../models/friendRequest');
const filterObject = require('../utils/filterObject');

exports.updateMe = async function (req, res, next) {
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
};

exports.getUsers = async function (req, res, next) {
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
};

exports.getRequests = async function (req, res, next) {
  const requests = await FriendRequest.find({
    reciever: req.user._id,
  }).populate('sender', '_id firstName lastName');

  res.status(200).json({
    status: 'success',
    data: requests,
    message: 'All requests fetched successfully!',
  });
};

exports.getFriends = async function (req, res, next) {
  const thisUser = await User.findById(req.user._id).populate(
    'friends',
    '_id firstName lastName'
  );

  res.status(200).json({
    status: 'success',
    data: thisUser.friends,
    message: 'All friends fetched successfully!',
  });
};
