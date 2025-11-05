// --- index.js ---
const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { jwtVerify } = require("jose");
require("dotenv").config(); // ✅ Load NEXTAUTH_SECRET and others from .env

const port = 3000;
const { ImageModel } = require("./model/image.module");
const resumeRoutes = require('./routes/resume.routes');
const analyticsRoutes = require('./routes/analytics.routes');

// ============================================
// CREATE HTTP SERVER & SOCKET.IO
// ============================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, specify your frontend URL
    methods: ["GET", "POST"]
  }
});

// --- Config ---
const UPLOAD_DIR = "./uploads";
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase from default 100kb to 50mb
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/api/resume', resumeRoutes);
app.use('/api', analyticsRoutes);

// ============================================
// SOCKET.IO STORAGE FOR CHAT
// ============================================
const activeUsers = new Map(); // userId -> {socketId, userName, userEmail}
const activeRecruiters = new Map(); // recruiterEmail -> socketId
const chatHistory = new Map(); // userId -> [{message, from, timestamp}]

// The ONE recruiter who receives all messages - CHANGE THIS!
const RECRUITER_EMAIL = "harry123@gmail.com";

// ✅ Verify NextAuth Token Middleware (from your NextAuth JWT)
async function verifyNextAuthToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);

    // Token generated from NextAuth jwt() callback includes `role` + `sub` or `id`
    req.user = {
      id: payload.id || payload.sub,
      role: payload.role || "user",
      email: payload.email,
    };

    next();
  } catch (err) {
    console.error("🔴 Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// --- Default Route ---
app.get("/", (req, res) => {
  res.send("Image Upload Server Running with NextAuth Integration & Socket.IO Chat ✅");
});

// --- Multer Storage ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, name + "-" + Date.now() + ext);
  },
});

const upload = multer({ storage });

// --- Upload Image ---
app.post("/single", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send({ msg: "No file uploaded." });

    const { title } = req.body;
    const { filename } = req.file;
    const relativePath = path.join(UPLOAD_DIR, filename);

    const image = new ImageModel({
      title,
      path: relativePath,
      filename,
    });
    await image.save();

    res.status(201).send({
      msg: "Image Uploaded Successfully ✅",
      filename,
      id: image._id,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).send({ error: error.message });
  }
});

// ✅ --- SECURE ADMIN ROUTE ---
app.get("/userssss", verifyNextAuthToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied — Admins only 🚫" });
    }

    const allUsers = await ImageModel.find().select("title filename _id");
    res.status(200).json({
      message: "✅ Admin access granted",
      admin: req.user.email,
      users: allUsers,
    });
  } catch (error) {
    console.error("Admin user fetch error:", error);
    res.status(500).json({ message: "Server error retrieving user data" });
  }
});

// --- Get Image by ID ---
app.get("/img/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const image = await ImageModel.findById(id);
    if (!image) return res.status(404).send({ msg: "Image Not Found" });

    const absolutePath = path.join(__dirname, image.path);
    if (fs.existsSync(absolutePath)) {
      res.sendFile(absolutePath);
    } else {
      res.status(404).send({ msg: "Image file missing on server disk." });
    }
  } catch (err) {
    console.error("Retrieve error:", err);
    res.status(500).send({ error: err.message });
  }
});

// --- Get All Resumes ---
app.get("/resumes", async (req, res) => {
  try {
    const images = await ImageModel.find().sort({ _id: -1 });
    res.status(200).json(
      images.map((img) => ({
        _id: img._id,
        title: img.title,
        filename: img.filename,
      }))
    );
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ error: "Failed to fetch resumes" });
  }
});

// --- Delete Resume by ID ---
app.delete("/resumes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const image = await ImageModel.findById(id);
    if (!image) return res.status(404).json({ msg: "Resume not found." });

    const filePath = path.join(__dirname, image.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await ImageModel.findByIdAndDelete(id);
    res.status(200).json({ msg: "Resume deleted successfully ✅" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: "Failed to delete resume." });
  }
});

// ============================================
// SOCKET.IO CHAT FUNCTIONALITY
// ============================================
io.on('connection', (socket) => {
  console.log('🔌 New socket connection:', socket.id);

  // ==========================================
  // USER SIDE - User joins chat
  // ==========================================
  socket.on('user-join-chat', (data) => {
    const { userId, userName, userEmail } = data;
    
    console.log(`👤 User joined chat: ${userName} (${userId})`);
    
    // Store user connection
    activeUsers.set(userId, {
      socketId: socket.id,
      userName,
      userEmail: userEmail || 'anonymous@user.com'
    });
    
    // Join user to their private room
    socket.join(`user-${userId}`);
    
    // Store userId in socket for cleanup
    socket.userId = userId;
    socket.userType = 'user';
    
    // Send previous chat history to user
    const history = chatHistory.get(userId) || [];
    socket.emit('chat-history', history);
    
    // Notify recruiter about new user (if recruiter is online)
    if (activeRecruiters.has(RECRUITER_EMAIL)) {
      io.to(activeRecruiters.get(RECRUITER_EMAIL)).emit('user-connected', {
        userId,
        userName,
        userEmail: userEmail || 'anonymous@user.com',
        timestamp: new Date().toISOString()
      });
    }
    
    socket.emit('chat-joined', {
      success: true,
      message: 'Connected to recruiter chat'
    });
  });

  // ==========================================
  // USER SIDE - User sends message to recruiter
  // ==========================================
  socket.on('user-message-to-recruiter', (data) => {
    const { userId, userName, message, timestamp } = data;
    
    console.log(`💬 Message from ${userName}: ${message}`);
    
    // Store message in history
    if (!chatHistory.has(userId)) {
      chatHistory.set(userId, []);
    }
    chatHistory.get(userId).push({
      message,
      from: 'user',
      userName,
      timestamp
    });
    
    // Send to SPECIFIC RECRUITER (if online)
    if (activeRecruiters.has(RECRUITER_EMAIL)) {
      io.to(activeRecruiters.get(RECRUITER_EMAIL)).emit('new-user-message', {
        userId,
        userName,
        userEmail: activeUsers.get(userId)?.userEmail || 'unknown',
        message,
        timestamp
      });
      console.log(`✅ Message delivered to recruiter: ${RECRUITER_EMAIL}`);
    } else {
      console.log(`⚠️ Recruiter ${RECRUITER_EMAIL} is offline`);
    }
    
    // Acknowledge to user
    socket.emit('message-sent', { success: true });
  });

  // ==========================================
  // RECRUITER SIDE - Recruiter logs in
  // ==========================================
  socket.on('recruiter-login', (data) => {
    const { recruiterEmail, recruiterName } = data;
    
    // Only allow THE specific recruiter
    if (recruiterEmail !== RECRUITER_EMAIL) {
      socket.emit('login-failed', {
        message: 'Unauthorized: You are not the designated recruiter'
      });
      return;
    }
    
    console.log(`👨‍💼 Recruiter logged in: ${recruiterName} (${recruiterEmail})`);
    
    // Store recruiter connection
    activeRecruiters.set(recruiterEmail, socket.id);
    socket.join('recruiter-room');
    
    // Store in socket for cleanup
    socket.recruiterEmail = recruiterEmail;
    socket.userType = 'recruiter';
    
    // Send list of all active users with their chat history
    const allUsers = [];
    for (const [userId, userInfo] of activeUsers.entries()) {
      allUsers.push({
        userId,
        userName: userInfo.userName,
        userEmail: userInfo.userEmail,
        isOnline: true,
        messages: chatHistory.get(userId) || []
      });
    }
    
    // Also include users who have chat history but are not currently online
    for (const [userId, messages] of chatHistory.entries()) {
      if (!activeUsers.has(userId) && messages.length > 0) {
        allUsers.push({
          userId,
          userName: messages[0].userName || 'Unknown User',
          userEmail: 'offline@user.com',
          isOnline: false,
          messages: messages
        });
      }
    }
    
    socket.emit('recruiter-logged-in', {
      success: true,
      activeUsers: allUsers,
      recruiterEmail
    });
  });

  // ==========================================
  // RECRUITER SIDE - Recruiter replies to user
  // ==========================================
  socket.on('recruiter-reply-to-user', (data) => {
    const { userId, message, recruiterName } = data;
    
    console.log(`💼 Recruiter reply to ${userId}: ${message}`);
    
    // Store in chat history
    if (!chatHistory.has(userId)) {
      chatHistory.set(userId, []);
    }
    chatHistory.get(userId).push({
      message,
      from: 'recruiter',
      recruiterName,
      timestamp: new Date().toISOString()
    });
    
    // Send to specific user
    io.to(`user-${userId}`).emit('recruiter-message', {
      message,
      recruiterName: recruiterName || 'Recruiter',
      timestamp: new Date().toISOString()
    });
    
    // Acknowledge to recruiter
    socket.emit('reply-sent', { success: true, userId });
    
    console.log(`✅ Reply sent to user ${userId}`);
  });

  // ==========================================
  // RECRUITER SIDE - Get specific user's chat
  // ==========================================
  socket.on('get-user-chat', (data) => {
    const { userId } = data;
    const history = chatHistory.get(userId) || [];
    socket.emit('user-chat-history', { userId, messages: history });
  });

  // ==========================================
  // DISCONNECT HANDLER
  // ==========================================
  socket.on('disconnect', () => {
    if (socket.userType === 'user' && socket.userId) {
      console.log(`👤 User disconnected: ${socket.userId}`);
      
      // Remove from active users
      activeUsers.delete(socket.userId);
      
      // Notify recruiter
      if (activeRecruiters.has(RECRUITER_EMAIL)) {
        io.to(activeRecruiters.get(RECRUITER_EMAIL)).emit('user-disconnected', {
          userId: socket.userId
        });
      }
    } else if (socket.userType === 'recruiter' && socket.recruiterEmail) {
      console.log(`👨‍💼 Recruiter disconnected: ${socket.recruiterEmail}`);
      activeRecruiters.delete(socket.recruiterEmail);
    }
  });
});

// ============================================
// REST API ENDPOINTS FOR CHAT (Optional - for debugging)
// ============================================
app.get('/api/chat/active-users', (req, res) => {
  const users = Array.from(activeUsers.entries()).map(([userId, info]) => ({
    userId,
    ...info,
    messageCount: (chatHistory.get(userId) || []).length
  }));
  res.json({ users, count: users.length });
});

app.get('/api/chat/history/:userId', (req, res) => {
  const messages = chatHistory.get(req.params.userId) || [];
  res.json({ userId: req.params.userId, messages });
});

app.get('/api/chat/recruiter-status', (req, res) => {
  res.json({
    isOnline: activeRecruiters.has(RECRUITER_EMAIL),
    recruiterEmail: RECRUITER_EMAIL
  });
});

// ============================================
// START SERVER (Use server.listen instead of app.listen)
// ============================================
server.listen(port, async () => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

  try {
    await mongoose.connect(
      "mongodb+srv://200ksuscribers_db_user:harry_123@cluster0.oovy5cs.mongodb.net/UploadImage?retryWrites=true&w=majority"
    );
    console.log("✅ Database connected");
    console.log(`🚀 Server running on port ${port}`);
    console.log(`💬 Socket.IO Chat enabled`);
    console.log(`📧 Designated Recruiter: ${RECRUITER_EMAIL}`);
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
});