#!/usr/bin/env node

/**
 * Test script for the Web Content Agent plugin
 * 
 * This script demonstrates the key functionality of the plugin:
 * 1. Content generation from prompts
 * 2. Content analysis and suggestions
 * 3. SEO optimization recommendations
 */

const axios = require('axios').default;

const STRAPI_BASE_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const API_BASE = `${STRAPI_BASE_URL}/api/web-content-agent`;

console.log('🤖 Web Content Agent - API Test Suite');
console.log('=====================================\n');

async function testContentGeneration() {
  console.log('1. Testing Content Generation...');
  
  try {
    const response = await axios.post(`${API_BASE}/ai/generate`, {
      prompt: 'Write a comprehensive guide about the benefits of using AI in content marketing. Include practical tips and real-world examples.',
      contentType: 'article',
      targetAudience: 'marketing'
    });

    console.log('✅ Content Generation successful!');
    console.log('Generated content preview:');
    console.log(response.data.data.content.substring(0, 200) + '...\n');
  } catch (error) {
    console.log('❌ Content Generation failed:');
    console.log(error.response?.data?.error?.message || error.message);
    console.log('');
  }
}

async function testContentSuggestions() {
  console.log('2. Testing Content Suggestions...');
  
  const sampleContent = `
    AI in Marketing
    
    Artificial intelligence is changing marketing. It helps with personalization and automation.
    Companies use AI for better customer experience.
  `;

  try {
    const response = await axios.post(`${API_BASE}/ai/suggestions`, {
      content: sampleContent,
      contentType: 'article'
    });

    console.log('✅ Content Suggestions successful!');
    console.log('Analysis results:');
    console.log(`- Clarity Score: ${response.data.data.clarityScore}/100`);
    console.log(`- Engagement Score: ${response.data.data.engagementScore}/100`);
    console.log(`- Structure Score: ${response.data.data.structureScore}/100`);
    console.log(`- Overall Score: ${response.data.data.overallScore}/100`);
    console.log('Suggestions:', response.data.data.suggestions.slice(0, 2));
    console.log('');
  } catch (error) {
    console.log('❌ Content Suggestions failed:');
    console.log(error.response?.data?.error?.message || error.message);
    console.log('');
  }
}

async function testPluginConfiguration() {
  console.log('3. Testing Plugin Configuration...');
  
  try {
    const response = await axios.get(`${API_BASE}/ai/config`);

    console.log('✅ Plugin Configuration retrieved!');
    console.log('Configuration:');
    console.log(`- Model: ${response.data.data.model}`);
    console.log(`- Max Tokens: ${response.data.data.maxTokens}`);
    console.log(`- Temperature: ${response.data.data.temperature}`);
    console.log(`- SEO Optimization: ${response.data.data.enableSeoOptimization ? 'Enabled' : 'Disabled'}`);
    console.log(`- Content Suggestions: ${response.data.data.enableContentSuggestions ? 'Enabled' : 'Disabled'}`);
    console.log(`- Content Generation: ${response.data.data.enableContentGeneration ? 'Enabled' : 'Disabled'}`);
    console.log(`- API Key Configured: ${response.data.data.hasApiKey ? 'Yes' : 'No'}`);
    console.log('');
  } catch (error) {
    console.log('❌ Plugin Configuration failed:');
    console.log(error.response?.data?.error?.message || error.message);
    console.log('');
  }
}

async function testContentTypes() {
  console.log('4. Testing Content Types Discovery...');
  
  try {
    const response = await axios.get(`${API_BASE}/content-types`);

    console.log('✅ Content Types discovery successful!');
    console.log('Available content types:');
    const contentTypes = Object.values(response.data.data);
    contentTypes.forEach(type => {
      console.log(`- ${type.displayName} (${type.uid})`);
    });
    console.log('');
  } catch (error) {
    console.log('❌ Content Types discovery failed:');
    console.log(error.response?.data?.error?.message || error.message);
    console.log('');
  }
}

async function runTests() {
  console.log(`Testing Strapi instance at: ${STRAPI_BASE_URL}\n`);
  
  await testPluginConfiguration();
  await testContentTypes();
  await testContentGeneration();
  await testContentSuggestions();
  
  console.log('🎉 Test suite completed!');
  console.log('\n📝 Notes:');
  console.log('- Ensure your OpenAI API key is configured in the environment');
  console.log('- The Strapi server should be running on the specified URL');
  console.log('- Some tests may fail if the API key is not set or if the server is not running');
}

// Install axios if not available
if (require.main === module) {
  runTests().catch(console.error);
}