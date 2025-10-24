# User-Specific Resume Implementation

## Overview
The resume system has been updated to make resumes user-specific. Each user can now only access, save, and manage their own resumes.

## Changes Made

### 1. Updated Resume Model (`model/resume.model.js`)
- Added `userId` field to associate resumes with specific users
- Made `userId` required to ensure all resumes are linked to a user

### 2. Updated Resume Routes (`routes/resume.routes.js`)
- Added authentication middleware (`verifyNextAuthToken`) to all resume routes
- Modified all routes to filter by `userId` to ensure user isolation

#### Routes Updated:
- **POST `/api/resume/save`** - Now requires authentication and saves resume with user's ID
- **GET `/api/resume/preview/:uniqueId`** - Only allows access to user's own resumes
- **GET `/api/resume/all`** - Returns only resumes for the authenticated user
- **DELETE `/api/resume/delete/:uniqueId`** - Only allows deletion of user's own resumes

## How It Works

1. **Authentication Required**: All resume operations now require a valid NextAuth JWT token
2. **User Isolation**: Each user can only see and manage their own resumes
3. **Secure Access**: Users cannot access resumes belonging to other users

## Frontend Integration

Your frontend will need to:
1. Include the NextAuth JWT token in the Authorization header for all resume API calls
2. Handle authentication errors (401) by redirecting to login
3. Update the hamburger menu to show only the current user's saved resumes

## API Usage Examples

### Save Resume (with authentication)
```javascript
const response = await fetch('/api/resume/save', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.accessToken}` // NextAuth token
  },
  body: JSON.stringify({
    name: 'My Resume',
    resumeData: resumeData
  })
});
```

### Get User's Resumes
```javascript
const response = await fetch('/api/resume/all', {
  headers: {
    'Authorization': `Bearer ${session.accessToken}`
  }
});
```

## Security Benefits

- **Data Isolation**: Users cannot access other users' resumes
- **Authentication**: All operations require valid authentication
- **Authorization**: Users can only perform operations on their own data
- **Privacy**: Resume data is completely private to each user

## Migration Notes

- Existing resumes without `userId` will need to be migrated or handled separately
- The system maintains backward compatibility for the API structure
- No changes needed to the frontend API calls (except adding authentication headers)
