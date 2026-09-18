const express = require('express');
const router = express.Router();
const { getDashboardReport, exportFinancialReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

// Every reporting route is authenticated; the group is resolved from the caller's membership.
router.use(protect);

router.get('/dashboard', getDashboardReport);
router.get('/export', exportFinancialReport);

module.exports = router;
