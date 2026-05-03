/**
 * Auth Middleware — memastikan user sudah login sebelum akses protected routes
 */
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Unauthorized. Silakan login terlebih dahulu.',
  });
};

module.exports = { requireAuth };
