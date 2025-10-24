const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Resume = require('../model/resume.model');

// Save resume
router.post('/save', async (req, res) => {
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
      resumeData
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

// Get resume by ID
router.get('/preview/:uniqueId', async (req, res) => {
  try {
    const { uniqueId } = req.params;
    const resume = await Resume.findOne({ uniqueId: uniqueId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
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

// Get all resumes
router.get('/all', async (req, res) => {
  try {
    const resumes = await Resume.find()
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



router.post('/api/resume/save', async (req, res) => {
  try {
    const resume = new Resume({
      userId: req.body.userId,
      uniqueId: generateUniqueId(), // or use _id
      // ... other resume fields
    });
    
    await resume.save();
    
    // Return the uniqueId in the response
    res.json({ 
      message: 'Resume saved successfully',
      uniqueId: resume.uniqueId || resume._id.toString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save resume' });
  }
});

module.exports = router;