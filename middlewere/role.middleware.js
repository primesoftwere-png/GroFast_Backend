// Updated role middleware (added explicit check for missing user or role, return 401 instead of 403)
module.exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized: No user found" });
      }

      if (!req.user.role) {
        return res.status(401).json({ 
          message: "Unauthorized: User role is missing or undefined. Please check your authentication token." 
        });
      }

      const userRole = req.user.role.toString().trim().toLowerCase();
      const allowedRoles = roles.map(role => role.toString().trim().toLowerCase());

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          message: `Access denied: ${req.user.role} role not allowed. Allowed roles: ${allowedRoles.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        message: "Error in role authorization",
        error: error.message,
      });
    }
  };
};