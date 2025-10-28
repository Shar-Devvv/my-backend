const express = require('express');
const router = express.Router();
const ViewModel = require('../model/view.model');
const { v4: uuidv4 } = require('uuid');

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

// POST /api/track-view - Track a resume view
router.post('/track-view', async (req, res) => {
  try {
    const { resumeId, uniqueId, viewDuration, sessionId } = req.body;
    
    // Validate required fields
    if (!resumeId) {
      return res.status(400).json({
        success: false,
        message: 'resumeId is required'
      });
    }

    // Get client information
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const referrerUrl = req.headers.referer || req.headers.referrer || null;
    
    // Parse user agent for detailed info
    const deviceInfo = parseUserAgent(userAgent);
    
    // Create view record
    const viewData = {
      resumeId,
      uniqueId: uniqueId || resumeId, // Use uniqueId if provided, otherwise use resumeId
      ipAddress,
      userAgent,
      browserName: deviceInfo.browserName,
      browserVersion: deviceInfo.browserVersion,
      deviceType: deviceInfo.deviceType,
      operatingSystem: deviceInfo.operatingSystem,
      referrerUrl,
      viewDuration: viewDuration || 0,
      sessionId: sessionId || uuidv4()
    };

    // Save to database
    const view = new ViewModel(viewData);
    await view.save();

    // Log successful tracking
    console.log(`📊 Resume view tracked: ${resumeId} from ${ipAddress} (${deviceInfo.deviceType})`);

    res.status(201).json({
      success: true,
      message: 'View tracked successfully',
      data: {
        viewId: view._id,
        resumeId: view.resumeId,
        timestamp: view.timestamp,
        isUniqueView: view.isUniqueView
      }
    });

  } catch (error) {
    console.error('Error tracking view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track view',
      error: error.message
    });
  }
});

// GET /api/views/:id - Get all views for a specific resume
router.get('/views/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, unique = false } = req.query;
    
    // Build query
    const query = { resumeId: id };
    if (unique === 'true') {
      query.isUniqueView = true;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get views with pagination
    const views = await ViewModel.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'); // Exclude version field
    
    // Get total count for pagination
    const totalViews = await ViewModel.countDocuments(query);
    const uniqueViews = await ViewModel.countDocuments({ resumeId: id, isUniqueView: true });
    
    // Calculate analytics
    const analytics = {
      totalViews,
      uniqueViews,
      totalPages: Math.ceil(totalViews / parseInt(limit)),
      currentPage: parseInt(page),
      viewsPerPage: parseInt(limit)
    };

    res.status(200).json({
      success: true,
      data: {
        views,
        analytics
      }
    });

  } catch (error) {
    console.error('Error fetching views:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch views',
      error: error.message
    });
  }
});

// GET /api/analytics/:id - Get analytics summary for a resume
router.get('/analytics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get basic counts
    const totalViews = await ViewModel.countDocuments({ resumeId: id });
    const uniqueViews = await ViewModel.countDocuments({ resumeId: id, isUniqueView: true });
    
    // Get device type breakdown
    const deviceBreakdown = await ViewModel.aggregate([
      { $match: { resumeId: id } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } }
    ]);
    
    // Get browser breakdown
    const browserBreakdown = await ViewModel.aggregate([
      { $match: { resumeId: id } },
      { $group: { _id: '$browserName', count: { $sum: 1 } } }
    ]);
    
    // Get OS breakdown
    const osBreakdown = await ViewModel.aggregate([
      { $match: { resumeId: id } },
      { $group: { _id: '$operatingSystem', count: { $sum: 1 } } }
    ]);
    
    // Get views over time (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const viewsOverTime = await ViewModel.aggregate([
      { $match: { resumeId: id, timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalViews,
          uniqueViews,
          duplicateViews: totalViews - uniqueViews
        },
        breakdowns: {
          devices: deviceBreakdown,
          browsers: browserBreakdown,
          operatingSystems: osBreakdown
        },
        viewsOverTime
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

module.exports = router;

