const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Resume = require('../model/resume.model');
const ViewModel = require('../model/view.model');
const { verifyNextAuthToken } = require('../middleware/verifyNexthAuth'); // ✅ use correct import

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


// Utility function to get client IP address
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip ||
         '127.0.0.1';
}

// Utility function to parse user agent and extract device info
function parseUserAgent(userAgent) {
  const ua = userAgent.toLowerCase();
  
  // Detect browser
  let browserName = 'Unknown';
  let browserVersion = '';
  
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browserName = 'Chrome';
    const match = ua.match(/chrome\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('firefox')) {
    browserName = 'Firefox';
    const match = ua.match(/firefox\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browserName = 'Safari';
    const match = ua.match(/version\/(\d+)/);
    if (match) browserVersion = match[1];
  } else if (ua.includes('edg')) {
    browserName = 'Edge';
    const match = ua.match(/edg\/(\d+)/);
    if (match) browserVersion = match[1];
  }
  
  // Detect device type
  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }
  
  // Detect operating system
  let operatingSystem = 'Unknown';
  if (ua.includes('windows')) {
    operatingSystem = 'Windows';
  } else if (ua.includes('mac os') || ua.includes('macos')) {
    operatingSystem = 'macOS';
  } else if (ua.includes('linux')) {
    operatingSystem = 'Linux';
  } else if (ua.includes('android')) {
    operatingSystem = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    operatingSystem = 'iOS';
  }
  
  return {
    browserName,
    browserVersion,
    deviceType,
    operatingSystem
  };
}

// PUBLIC: Get resume by uniqueId (NO authentication) with automatic tracking
router.get('/public/:uniqueId', async (req, res) => {
  try {
    const { uniqueId } = req.params;
    console.log('📋 Public preview for:', uniqueId);
    
    const resume = await Resume.findOne({ uniqueId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    // Track the view automatically
    try {
      const ipAddress = getClientIP(req);
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const referrerUrl = req.headers.referer || req.headers.referrer || null;
      
      // Parse user agent for detailed info
      const deviceInfo = parseUserAgent(userAgent);
      
      // Create view record
      const viewData = {
        resumeId: resume._id.toString(),
        uniqueId: uniqueId,
        ipAddress,
        userAgent,
        browserName: deviceInfo.browserName,
        browserVersion: deviceInfo.browserVersion,
        deviceType: deviceInfo.deviceType,
        operatingSystem: deviceInfo.operatingSystem,
        referrerUrl,
        sessionId: uuidv4()
      };

      // Save to database (async, don't wait for it)
      const view = new ViewModel(viewData);
      view.save().then(() => {
        console.log(`📊 Resume view tracked: ${uniqueId} from ${ipAddress} (${deviceInfo.deviceType})`);
      }).catch(err => {
        console.error('Error tracking view:', err);
      });

    } catch (trackingError) {
      console.error('Error in tracking:', trackingError);
      // Don't fail the main request if tracking fails
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
    console.error('Error:', error);
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
