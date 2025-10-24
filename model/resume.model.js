const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  uniqueId: { type: String, unique: true },
  name: { type: String, default: 'Untitled Resume' },
  resumeData: { type: Object },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

resumeSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const ResumeModel = mongoose.model('resumes', resumeSchema);
module.exports = ResumeModel; // ✅ simple export
