const jwt = require("jsonwebtoken");

module.exports.userMiddlewere = async (req, res, next) => {
  try {
    let token = req.cookies.token;
    if (req.headers["authorization"]) {
      token = req.headers["authorization"].replace("Bearer ", "").trim();
    }
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized - No token provided" 
      });
    }

    // Verify JWT directly to get specific error types
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "shrey@1011");
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized - Invalid token" 
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    // Specific message for expired tokens so the client knows to re-login
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ 
        success: false,
        message: "Token has expired, please login again" 
      });
    }

    // Handle other JWT errors (malformed, invalid signature, etc.)
    if (error.name === "JsonWebTokenError" ||
        error.message.includes("token") ||
        error.message.includes("jwt")) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized - Invalid token" 
      });
    }
    
    // Only log truly unexpected errors
    console.error("Auth middleware error:", error.message);
    res.status(500).json({ 
      success: false,
      message: "Server error", 
      error: error.message 
    });
  }
};
