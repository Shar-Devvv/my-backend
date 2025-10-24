// backend/middleware/verifyNextAuth.js
import { jwtVerify } from "jose";

export async function verifyNextAuthToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Missing token" });

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Optional: get fresh role from DB for higher security
    req.user = { id: payload.sub, role: payload.role || "user" };

    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
