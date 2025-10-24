// --- index.js ---
const express = require("express");
const app = express();
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

// --- Config ---
const UPLOAD_DIR = "./uploads";
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase from default 100kb to 50mb
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/api/resume', resumeRoutes);

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
  res.send("Image Upload Server Running with NextAuth Integration ✅");
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

// --- Start Server ---
app.listen(port, async () => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

  try {
    await mongoose.connect(
      "mongodb+srv://200ksuscribers_db_user:harry_123@cluster0.oovy5cs.mongodb.net/UploadImage?retryWrites=true&w=majority"
    );
    console.log("✅ Database connected");
    console.log(`🚀 Server running on port ${port}`);
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  }
});
