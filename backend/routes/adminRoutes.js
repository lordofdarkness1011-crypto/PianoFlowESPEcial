const express = require('express');
const { requireAdmin } = require('../middlewares/jwtMiddleware');
const { getUsers, grantPremium, generateCode, toggleUserStatus, getCodes } = require('../controllers/adminController');

const router = express.Router();

// Todas las rutas en este archivo requieren rol 'admin'
router.use(requireAdmin);

router.get('/users', getUsers);
router.get('/codes', getCodes);
router.post('/grant-premium', grantPremium);
router.post('/generate-code', generateCode);
router.post('/toggle-status', toggleUserStatus);

module.exports = router;
