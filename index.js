const express = require('express')
const app = express()
const multer = require('multer')
const mongoose = require('mongoose')
const cors = require('cors')
const port = 3000
const path = require('path')
const fs = require('fs') // Import File System module

// Ensure correct relative path for the model import
const { ImageModel } = require('./model/image.module') 

// --- Configuration ---
const UPLOAD_DIR = './uploads'

app.use(cors())
// To serve static files (the uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))) 

app.get('/', (req, res) => {
    res.send('Image Upload Server Running!')
})

// --- Multer Storage Configuration ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Multer will now use the UPLOAD_DIR constant
        cb(null, UPLOAD_DIR) 
    },
    filename: function (req, file, cb) {
        // Use path.extname to ensure the extension is always correct
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, name + '-' + Date.now() + ext)
    }
})

const upload = multer({ storage })

// --- POST Route for Image Upload ---
app.post("/single", upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ msg: "No file uploaded." });
        }
        
        // Destructure path and filename correctly from req.file
        const { path: filePath, filename } = req.file 
        
        // Save only the relative path (e.g., 'uploads/filename.png')
        // We can construct the full path later if needed.
        const relativePath = path.join(UPLOAD_DIR, filename); 

        const image = new ImageModel({ 
            path: relativePath, 
            filename: filename 
        })
        await image.save()

        res.status(201).send({ 
            msg: "Image Uploaded Successfully",
            filename: filename,
            id: image._id // Return the ID to use for the GET route
        })
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).send({ error: error.message })
    }
})

// --- GET Route to Retrieve Image ---
app.get("/img/:id", async (req, res) => {
    const { id } = req.params
    try {
        const image = await ImageModel.findById(id)
        if (!image) {
            return res.status(404).send({ "msg": "Image Not Found" })
        }

        // The path stored in the DB is the relative path (e.g., 'uploads/...')
        // We must join it with the current directory __dirname to make it absolute.
        const absolutePath = path.join(__dirname, image.path) 

        // Check if the file actually exists on the disk before sending
        if (fs.existsSync(absolutePath)) {
            // Serve the file directly
            res.sendFile(absolutePath)
        } else {
            res.status(404).send({ "msg": "Image file missing on server disk." })
        }
    } catch (err) {
        console.error("Retrieve error:", err);
        res.status(500).send({ error: err.message })
    }
})


// --- Server Start ---
app.listen(port, async () => {
    // 1. Check and Create Uploads Directory
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR)
        console.log(`Created directory: ${UPLOAD_DIR}`)
    }

    // 2. Connect to Database
    try {
        await mongoose.connect("mongodb+srv://200ksuscribers_db_user:harry_123@cluster0.oovy5cs.mongodb.net/UploadImage?retryWrites=true&w=majority&appName=Cluster0")
        console.log("DataBase is Connected")
        console.log(`App is running on port ${port}`)
    } catch (err) {
        console.error("Error connecting to MongoDB:", err)
    }
})
