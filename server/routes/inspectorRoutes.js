const express = require('express');
const router = express.Router();
const { protect, inspectorOnly } = require('../middleware/auth');
const {
  getAllGroupsForInspector,
  getGroupDetailsForInspector,
  getGlobalAnalyticsForInspector,
} = require('../controllers/inspectorController');

// All inspector endpoints require authentication + Inspector privileges
router.use(protect, inspectorOnly);

// @route GET /api/inspector/analytics
router.get('/analytics', getGlobalAnalyticsForInspector);

// @route GET /api/inspector/groups
router.get('/groups', getAllGroupsForInspector);

// @route GET /api/inspector/groups/:groupId
router.get('/groups/:groupId', getGroupDetailsForInspector);

module.exports = router;
