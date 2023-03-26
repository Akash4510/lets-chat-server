const User = require('../models/user');
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
