// backend/middleware/verifyNextAuth.js
const jwt = require('jsonwebtoken');

async function verifyNextAuthToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Missing or invalid token format" });
    }

    const token = authHeader.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    // ✅ CRITICAL FIX: Use ACCESS_TOKEN_SECRET instead of NEXTAUTH_SECRET
    const secret = process.env.ACCESS_TOKEN_SECRET;
    
    if (!secret) {
      console.error("❌ ACCESS_TOKEN_SECRET is not defined in backend .env");
      return res.status(500).json({ error: "Server configuration error" });
    }

    // Verify the token
    const decoded = jwt.verify(token, secret);
    
    // Set user data from token payload
    req.user = { 
      id: decoded.id,  // Access the 'id' field from your token payload
      email: decoded.email,
      role: decoded.role || "user" 
    };

    console.log("✅ Token verified successfully for user:", req.user.id);
    next();
    
  } catch (error) {
    console.error("❌ Token verification failed:", error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Token expired" });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { verifyNextAuthToken };