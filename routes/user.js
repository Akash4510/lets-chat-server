const router = require('express').Router();
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

router.patch('/update-me', authController.protect, userController.updateMe);
router.post('/get-users', authController.protect, userController.getUsers);
router.post('/get-friends', authController.protect, userController.getFriends);
router.post(
  '/get-friend-requests',
  authController.protect,
  userController.getRequests
);

module.exports = router;
