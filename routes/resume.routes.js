const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Resume = require('../model/resume.model');
const { verifyNextAuthToken } = require('../middleware/verifyNextAuth'); // ✅ use correct import

// Save resume (with authentication)
router.post('/save', verifyNextAuthToken, async (req, res) => {
  try {
    const { name, resumeData } = req.body;

    if (!resumeData) {
      return res.status(400).json({
        success: false,
        message: 'Resume data is required'
      });
    }

    const uniqueId = uuidv4();

    const newResume = new Resume({
      uniqueId,
      name: name || 'Untitled Resume',
      resumeData,
      userId: req.user.id // Associate with authenticated user
    });

    await newResume.save();

    res.status(201).json({
      success: true,
      message: 'Resume saved successfully',
      uniqueId,
      data: {
        id: newResume._id,
        uniqueId: newResume.uniqueId,
        name: newResume.name
      }
    });

  } catch (error) {
    console.error('Error saving resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save resume',
      error: error.message
    });
  }
});

// Get resume by ID (with authentication)
router.get('/preview/:uniqueId', verifyNextAuthToken, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const resume = await Resume.findOne({ 
      uniqueId: uniqueId,
      userId: req.user.id // Only allow access to user's own resumes
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      resume: {
        name: resume.name,
        resumeData: resume.resumeData,
        createdAt: resume.createdAt
      }
    });

  } catch (error) {
    console.error('Error fetching resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resume',
      error: error.message
    });
  }
});

// Get all resumes for authenticated user
router.get('/all', verifyNextAuthToken, async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .select('uniqueId name createdAt')
      .limit(50);

    res.status(200).json({
      success: true,
      count: resumes.length,
      resumes
    });

  } catch (error) {
    console.error('Error fetching resumes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resumes',
      error: error.message
    });
  }
});

// Delete resume (with authentication)
router.delete('/delete/:uniqueId', verifyNextAuthToken, async (req, res) => {
  try {
    const { uniqueId } = req.params;
    
    const resume = await Resume.findOneAndDelete({ 
      uniqueId: uniqueId,
      userId: req.user.id // Only allow deletion of user's own resumes
    });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found or access denied'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Resume deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting resume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resume',
      error: error.message
    });
  }
});

module.exports = router;
