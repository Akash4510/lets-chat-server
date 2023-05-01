const router = require('express').Router();
const testController = require('../controllers/testController');

router.post('/sendTestEmail', testController.sendOtp);

module.exports = router;
