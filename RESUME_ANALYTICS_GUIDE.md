# Resume Analytics Tracking System

## Overview
This system automatically tracks resume views and provides detailed analytics about who is viewing your resumes, when, and from where.

## Features Tracked

### 📊 Data Collected
- **resumeId**: The ID of the resume being viewed
- **uniqueId**: The unique identifier for the resume
- **ipAddress**: Viewer's IP address
- **timestamp**: When the view occurred
- **userAgent**: Browser information
- **browserName**: Detected browser (Chrome, Firefox, Safari, Edge)
- **browserVersion**: Browser version number
- **deviceType**: Device type (desktop, mobile, tablet)
- **operatingSystem**: OS (Windows, macOS, Linux, Android, iOS)
- **referrerUrl**: Where the viewer came from
- **viewDuration**: How long they viewed (if provided)
- **isUniqueView**: Whether this is a unique view (within 24 hours)
- **sessionId**: Unique session identifier

## API Endpoints

### 1. Track View (Manual)
**POST** `/api/track-view`

Manually track a resume view (useful for frontend tracking).

```javascript
// Example usage
const response = await fetch('/api/track-view', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    resumeId: 'resume_id_here',
    uniqueId: 'unique_id_here', // optional
    viewDuration: 30, // optional, in seconds
    sessionId: 'session_id_here' // optional
  })
});
```

### 2. Get Views for Resume
**GET** `/api/views/:id`

Get all views for a specific resume with pagination.

```javascript
// Example usage
const response = await fetch('/api/views/resume_id_here?page=1&limit=20&unique=true');
const data = await response.json();

// Response includes:
// - views: Array of view records
// - analytics: Pagination and summary info
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)
- `unique`: Show only unique views (true/false)

### 3. Get Analytics Summary
**GET** `/api/analytics/:id`

Get comprehensive analytics for a resume.

```javascript
// Example usage
const response = await fetch('/api/analytics/resume_id_here');
const data = await response.json();

// Response includes:
// - summary: Total views, unique views, duplicate views
// - breakdowns: Device, browser, OS breakdowns
// - viewsOverTime: Views per day for last 30 days
```

### 4. Public Resume View (Auto-tracking)
**GET** `/api/resume/public/:uniqueId`

Automatically tracks views when resumes are accessed publicly.

```javascript
// Example usage
const response = await fetch('/api/resume/public/unique_resume_id');
const data = await response.json();

// This endpoint automatically tracks the view
// No additional tracking call needed
```

## Database Schema

### View Model (`model/view.model.js`)
```javascript
{
  resumeId: String,        // Required, indexed
  uniqueId: String,        // Required, indexed
  ipAddress: String,      // Required
  timestamp: Date,        // Auto-generated, indexed
  userAgent: String,      // Required
  browserName: String,
  browserVersion: String,
  deviceType: String,     // desktop, mobile, tablet, unknown
  operatingSystem: String,
  referrerUrl: String,
  country: String,        // Future: IP geolocation
  city: String,           // Future: IP geolocation
  isp: String,            // Future: IP geolocation
  viewDuration: Number,   // In seconds
  isUniqueView: Boolean,  // Auto-calculated
  sessionId: String
}
```

## Automatic Tracking

### How It Works
1. **Public Resume Access**: When someone visits `/api/resume/public/:uniqueId`, the system automatically:
   - Extracts IP address from request headers
   - Parses user agent for device/browser info
   - Detects referrer URL
   - Saves tracking data to database
   - Returns resume data

2. **Unique View Detection**: The system automatically detects unique views by checking if the same IP has viewed the resume within the last 24 hours.

3. **Non-blocking**: Tracking happens asynchronously, so it doesn't slow down the main request.

## Frontend Integration

### Automatic Tracking (Recommended)
Use the public endpoint for automatic tracking:

```javascript
// In your frontend component
const fetchResume = async (uniqueId) => {
  try {
    const response = await fetch(`/api/resume/public/${uniqueId}`);
    const data = await response.json();
    
    if (data.success) {
      // Resume data is available
      console.log('Resume loaded and view tracked automatically');
      return data.resume;
    }
  } catch (error) {
    console.error('Error loading resume:', error);
  }
};
```

### Manual Tracking
If you need more control over tracking:

```javascript
// Track view manually
const trackView = async (resumeId, uniqueId) => {
  try {
    const response = await fetch('/api/track-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resumeId,
        uniqueId,
        viewDuration: 30 // seconds
      })
    });
    
    if (response.ok) {
      console.log('View tracked successfully');
    }
  } catch (error) {
    console.error('Error tracking view:', error);
  }
};
```

## Analytics Dashboard

### View Analytics
```javascript
// Get analytics for a resume
const getAnalytics = async (resumeId) => {
  try {
    const response = await fetch(`/api/analytics/${resumeId}`);
    const data = await response.json();
    
    if (data.success) {
      console.log('Total views:', data.data.summary.totalViews);
      console.log('Unique views:', data.data.summary.uniqueViews);
      console.log('Device breakdown:', data.data.breakdowns.devices);
      console.log('Browser breakdown:', data.data.breakdowns.browsers);
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
  }
};
```

### View History
```javascript
// Get view history with pagination
const getViewHistory = async (resumeId, page = 1) => {
  try {
    const response = await fetch(`/api/views/${resumeId}?page=${page}&limit=20`);
    const data = await response.json();
    
    if (data.success) {
      console.log('Views:', data.data.views);
      console.log('Pagination:', data.data.analytics);
    }
  } catch (error) {
    console.error('Error fetching view history:', error);
  }
};
```

## Security & Privacy

### IP Address Handling
- IP addresses are stored for analytics purposes
- Consider implementing IP anonymization for GDPR compliance
- Views are tracked per IP, not per user account

### Data Retention
- Consider implementing data retention policies
- Views older than X days can be automatically deleted
- Implement cleanup jobs for old tracking data

## Performance Considerations

### Database Indexes
- `resumeId` and `timestamp` are indexed for fast queries
- `uniqueId` is indexed for quick lookups
- Compound indexes optimize common query patterns

### Async Tracking
- View tracking happens asynchronously
- Main request is not blocked by tracking operations
- Failed tracking doesn't affect resume loading

## Future Enhancements

### Geolocation
- Add IP geolocation to track country/city
- Use services like MaxMind or IPinfo

### Advanced Analytics
- Track scroll depth
- Track time spent on page
- Track PDF downloads
- Track sharing events

### Real-time Updates
- WebSocket integration for real-time analytics
- Live view counters
- Real-time notifications for new views

## Error Handling

The system is designed to be resilient:
- Tracking failures don't affect resume loading
- Invalid data is logged but doesn't crash the system
- Graceful fallbacks for missing data

## Console Logging

The system provides detailed console logging:
- `📊 Resume view tracked: [uniqueId] from [IP] ([device])`
- Error messages for debugging
- Success confirmations for manual tracking

