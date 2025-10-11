const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema({
    title:{type: String, required: true},
    // Store the relative file path for serving
    path: { type: String, required: true }, 
    // Store the filename for reference
    filename: { type: String, required: true },
    role:{type: String,enum: ['user', 'manager', 'admin'], default: 'user'} 
})

const ImageModel = mongoose.model('images', imageSchema)

// Export the model directly
module.exports = { ImageModel }
