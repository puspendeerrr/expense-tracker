const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: 'User account not found' });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('Auth Middleware Error:', error.message);
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

const superAdminOnly = (req, res, next) => {
  if (req.user && (req.user.isSuperAdmin || req.user.email === 'admin@gmail.com')) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Super Admin privilege required.' });
};

const readOnlyInspectorCheck = async (req, res, next) => {
  try {
    let user = req.user;
    if (!user && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      user = await User.findById(decoded.id).select('-password');
    }

    if (user && (user.isInspector || user.email === 'inspect@gmail.com')) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return res.status(403).json({
          message: 'Inspector account is in read-only mode. Modifying operations are not permitted.',
        });
      }
    }
  } catch (err) {
    // Ignore token errors here, let protect middleware handle 401s
  }
  return next();
};

const inspectorOnly = (req, res, next) => {
  if (req.user && (req.user.isInspector || req.user.email === 'inspect@gmail.com' || req.user.isSuperAdmin || req.user.email === 'admin@gmail.com')) {
    return next();
  }
  return res.status(403).json({ message: 'Access denied: Inspector privilege required.' });
};

module.exports = { protect, superAdminOnly, readOnlyInspectorCheck, inspectorOnly };
