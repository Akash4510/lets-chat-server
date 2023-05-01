const router = require('express').Router();
const authRoute = require('./auth');
const userRoute = require('./user');
const testRoute = require('./test');

router.use('/auth', authRoute);
router.use('/user', userRoute);
router.use('/test', testRoute);

module.exports = router;
