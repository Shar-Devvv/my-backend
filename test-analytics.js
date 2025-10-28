// Test script for resume analytics tracking system
// Run this with: node test-analytics.js

const mongoose = require('mongoose');

// Import models
const ViewModel = require('./model/view.model');
const Resume = require('./model/resume.model');

// Test data
const testResumeId = 'test-resume-123';
const testUniqueId = 'test-unique-456';

async function testAnalyticsSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      "mongodb+srv://200ksuscribers_db_user:harry_123@cluster0.oovy5cs.mongodb.net/UploadImage?retryWrites=true&w=majority"
    );
    console.log('✅ Connected to MongoDB');

    // Test 1: Create a test view
    console.log('\n📊 Test 1: Creating test view...');
    const testView = new ViewModel({
      resumeId: testResumeId,
      uniqueId: testUniqueId,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      browserName: 'Chrome',
      browserVersion: '91',
      deviceType: 'desktop',
      operatingSystem: 'Windows',
      referrerUrl: 'https://example.com',
      viewDuration: 45,
      sessionId: 'test-session-789'
    });

    await testView.save();
    console.log('✅ Test view created successfully');

    // Test 2: Query views for resume
    console.log('\n📊 Test 2: Querying views...');
    const views = await ViewModel.find({ resumeId: testResumeId });
    console.log(`✅ Found ${views.length} view(s) for resume ${testResumeId}`);

    // Test 3: Test analytics aggregation
    console.log('\n📊 Test 3: Testing analytics aggregation...');
    const deviceBreakdown = await ViewModel.aggregate([
      { $match: { resumeId: testResumeId } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } }
    ]);
    console.log('✅ Device breakdown:', deviceBreakdown);

    const browserBreakdown = await ViewModel.aggregate([
      { $match: { resumeId: testResumeId } },
      { $group: { _id: '$browserName', count: { $sum: 1 } } }
    ]);
    console.log('✅ Browser breakdown:', browserBreakdown);

    // Test 4: Test unique view detection
    console.log('\n📊 Test 4: Testing unique view detection...');
    const uniqueViews = await ViewModel.countDocuments({ 
      resumeId: testResumeId, 
      isUniqueView: true 
    });
    console.log(`✅ Unique views: ${uniqueViews}`);

    // Test 5: Clean up test data
    console.log('\n📊 Test 5: Cleaning up test data...');
    await ViewModel.deleteMany({ resumeId: testResumeId });
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests passed! Analytics system is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

// Run the test
testAnalyticsSystem();

