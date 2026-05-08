// Middleware-fabrik som returnerar en Express-middleware som kräver att
// inloggad användare har minst en av de angivna rollerna.
//
// Anv: router.get("/admin/...", authenticateToken, requireRole("super-admin"), handler)
//
// Förutsätter att authenticateToken-middlewaren har körts först och satt
// req.user (med roles-array).
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: "Inte inloggad." });
    }
    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        message: "Du har inte behörighet att göra det här.",
      });
    }
    next();
  };
}

module.exports = requireRole;
