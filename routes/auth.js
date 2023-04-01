const router = require('express').Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.register, authController.sendOtp);
router.post('/send-otp', authController.sendOtp);
router.post('/verify-email', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
