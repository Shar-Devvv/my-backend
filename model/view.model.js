const mongoose = require('mongoose');

// Schema for tracking resume view analytics
const viewSchema = new mongoose.Schema({
  resumeId: { 
    type: String, 
    required: true,
    index: true // Add index for faster queries
  },
  uniqueId: { 
    type: String, 
    required: true,
    index: true // Add index for faster queries
  },
  ipAddress: { 
    type: String, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true // Add index for faster queries
  },
  userAgent: { 
    type: String, 
    required: true 
  },
  browserName: { 
    type: String 
  },
  browserVersion: { 
    type: String 
  },
  deviceType: { 
    type: String, 
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    default: 'unknown'
  },
  operatingSystem: { 
    type: String 
  },
  referrerUrl: { 
    type: String 
  },
  country: { 
    type: String 
  },
  city: { 
    type: String 
  },
  isp: { 
    type: String 
  },
  viewDuration: { 
    type: Number, // in seconds
    default: 0
  },
  isUniqueView: { 
    type: Boolean, 
    default: true 
  },
  sessionId: { 
    type: String 
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Compound index for better query performance
viewSchema.index({ resumeId: 1, timestamp: -1 });
viewSchema.index({ uniqueId: 1, timestamp: -1 });

// Pre-save middleware to detect unique views
viewSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Check if this IP has viewed this resume before
    const existingView = await this.constructor.findOne({
      resumeId: this.resumeId,
      ipAddress: this.ipAddress,
      // Check within last 24 hours for "unique" view
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    this.isUniqueView = !existingView;
  }
  next();
});

const ViewModel = mongoose.model('views', viewSchema);
module.exports = ViewModel;

