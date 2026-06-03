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

// SuperAdmin middleware
module.exports.isSuperAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized: No user found" 
      });
    }

    if (!req.user.role) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized: User role is missing" 
      });
    }

    const userRole = req.user.role.toString().trim().toLowerCase();

    if (userRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: "Access denied: SuperAdmin role required"
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error in role authorization",
      error: error.message
    });
  }
};

// Admin middleware (for both admin and superadmin)
module.exports.isAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized: No user found" 
      });
    }

    if (!req.user.role) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized: User role is missing" 
      });
    }

    const userRole = req.user.role.toString().trim().toLowerCase();

    if (userRole !== 'admin' && userRole !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: "Access denied: Admin role required"
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error in role authorization",
      error: error.message
    });
  }
};