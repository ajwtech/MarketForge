# Web Content Agent Integration Guide

## Overview

The Web Content Agent is a comprehensive AI-powered plugin that enhances your Strapi CMS with intelligent content creation, optimization, and analysis capabilities. This guide shows you how to integrate and use it effectively.

## 🚀 Quick Start

1. **Configure OpenAI API Key**
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

2. **Start Strapi with the Plugin**
   ```bash
   cd launchpad/strapi
   yarn develop
   ```

3. **Access the Plugin**
   - Open Strapi Admin: http://localhost:1337/admin
   - Look for "🤖 Web Content Agent" in the sidebar

## 🎯 Use Cases

### 1. Content Creation Workflow

**Traditional Workflow:**
```
Writer creates content → Editor reviews → SEO specialist optimizes → Publish
```

**With Web Content Agent:**
```
AI generates draft → Writer refines → Auto-SEO optimization → Publish
```

**Example API Usage:**
```javascript
// Generate initial content
const content = await fetch('/api/web-content-agent/ai/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Write a beginner-friendly guide about sustainable living',
    contentType: 'article',
    targetAudience: 'beginner'
  })
});

// Create Strapi entry with generated content
const entry = await fetch('/api/web-content-agent/content/api::article.article/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Write a beginner-friendly guide about sustainable living',
    targetAudience: 'beginner',
    options: { publishImmediately: false }
  })
});
```

### 2. SEO Optimization Workflow

**For Existing Content:**
```javascript
// Analyze existing content for SEO
const analysis = await fetch('/api/web-content-agent/seo/recommendations/api::article.article/123');
const recommendations = await analysis.json();

// Apply optimizations
const optimizations = {
  title: recommendations.data.titleSuggestions[0],
  metaDescription: recommendations.data.metaDescriptionSuggestions[0],
  keywords: recommendations.data.keywordSuggestions.join(', ')
};

await fetch('/api/web-content-agent/seo/apply/api::article.article/123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(optimizations)
});
```

### 3. Content Quality Assurance

**Automated Content Review:**
```javascript
// Analyze content quality
const analysis = await fetch('/api/web-content-agent/ai/suggestions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: existingContent,
    contentType: 'article'
  })
});

const scores = await analysis.json();
console.log(`Content Quality: ${scores.data.overallScore}/100`);
console.log('Suggestions:', scores.data.suggestions);
```

## 🔧 Integration Patterns

### Frontend Integration

**React Hook for Content Generation:**
```jsx
import { useState } from 'react';

export const useContentAgent = (strapiUrl = 'http://localhost:1337') => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateContent = async (prompt, contentType = 'article', targetAudience = 'general') => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${strapiUrl}/api/web-content-agent/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, contentType, targetAudience })
      });
      
      if (!response.ok) throw new Error('Generation failed');
      const data = await response.json();
      return data.data.content;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const optimizeForSEO = async (contentType, entryId) => {
    setLoading(true);
    try {
      const response = await fetch(`${strapiUrl}/api/web-content-agent/seo/recommendations/${contentType}/${entryId}`);
      const data = await response.json();
      return data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { generateContent, optimizeForSEO, loading, error };
};
```

### Webhook Integration

**Auto-optimize new content:**
```javascript
// In your Strapi lifecycle hooks
module.exports = {
  async afterCreate(event) {
    const { result } = event;
    
    // Auto-generate SEO recommendations for new articles
    if (event.model.uid === 'api::article.article') {
      try {
        const seoService = strapi.plugin('web-content-agent').service('seo-service');
        const recommendations = await seoService.generateSEORecommendations(
          event.model.uid, 
          result.id
        );
        
        // Store recommendations in a custom field or send notification
        console.log('SEO recommendations generated:', recommendations);
      } catch (error) {
        console.error('SEO analysis failed:', error);
      }
    }
  }
};
```

### Batch Processing

**Bulk SEO Optimization:**
```javascript
// Optimize multiple entries at once
const optimizeBulk = async (contentType, entryIds) => {
  const response = await fetch('/api/web-content-agent/seo/bulk-optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, entryIds })
  });
  
  const results = await response.json();
  console.log(`Processed ${results.data.totalProcessed} entries`);
  console.log(`Success: ${results.data.successCount}, Errors: ${results.data.errorCount}`);
  
  return results.data.results;
};
```

## 📊 Monitoring and Analytics

### Content Performance Tracking

```javascript
// Track content performance over time
const trackContentPerformance = async (contentType, entryId) => {
  const analysis = await fetch(`/api/web-content-agent/ai/analyze/${contentType}/${entryId}`);
  const data = await analysis.json();
  
  // Store metrics for trend analysis
  const metrics = {
    entryId,
    seoScore: data.data.seoAnalysis.seoScore,
    clarityScore: data.data.contentSuggestions.clarityScore,
    engagementScore: data.data.contentSuggestions.engagementScore,
    analyzedAt: new Date().toISOString()
  };
  
  // Send to your analytics system
  return metrics;
};
```

## 🛠️ Custom Extensions

### Adding Custom Content Types

The plugin automatically detects your content types, but you can customize analysis:

```javascript
// In your content service extension
const customAnalyzer = {
  async analyzeProductDescription(content, metadata) {
    // Custom analysis logic for product descriptions
    const prompt = `
      Analyze this product description for e-commerce effectiveness:
      ${content}
      
      Consider: persuasiveness, clarity, feature highlighting, and call-to-action strength.
    `;
    
    return await this.aiService.generateContent(prompt);
  }
};
```

### Custom Prompts

```javascript
// Create content type-specific prompts
const createPromptTemplate = (contentType, audience, industry) => {
  const templates = {
    'product-description': `Write a compelling product description for ${industry} targeting ${audience}. Focus on benefits and unique selling points.`,
    'blog-post': `Create an engaging blog post for ${audience} in the ${industry} industry. Include actionable insights and examples.`,
    'social-media': `Write social media content for ${audience}. Keep it concise, engaging, and include relevant hashtags.`
  };
  
  return templates[contentType] || templates['blog-post'];
};
```

## 📈 Best Practices

### 1. Content Generation
- **Be Specific**: Use detailed prompts for better results
- **Iterate**: Generate multiple versions and combine the best parts
- **Review**: Always review and edit AI-generated content
- **Brand Voice**: Include brand guidelines in your prompts

### 2. SEO Optimization
- **Regular Audits**: Run SEO analysis monthly for all content
- **Keyword Strategy**: Use suggested keywords but maintain natural flow
- **Meta Optimization**: Always customize suggested meta descriptions
- **Monitor Changes**: Track SEO score improvements over time

### 3. Performance
- **Batch Operations**: Use bulk endpoints for large-scale operations
- **Caching**: Cache analysis results to avoid redundant API calls
- **Rate Limiting**: Respect OpenAI API rate limits
- **Error Handling**: Implement robust error handling for API failures

## 🔒 Security Considerations

1. **API Key Management**: Store OpenAI API keys securely
2. **Input Validation**: Validate all user inputs before processing
3. **Access Control**: Restrict plugin access to authorized users
4. **Content Review**: Implement approval workflows for AI-generated content
5. **Rate Limiting**: Implement rate limiting to prevent abuse

## 🐛 Troubleshooting

### Common Issues

**Plugin not loading:**
```bash
# Check plugin registration
grep -r "web-content-agent" launchpad/strapi/config/

# Verify build
cd launchpad/strapi && yarn build
```

**API calls failing:**
```bash
# Check OpenAI API key
echo $OPENAI_API_KEY

# Test API connectivity
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

**Content generation issues:**
- Reduce `maxTokens` if responses are cut off
- Adjust `temperature` for more/less creative output
- Check prompt clarity and specificity

## 📚 Additional Resources

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Strapi Plugin Development](https://docs.strapi.io/developer-docs/latest/development/plugin-development.html)
- [SEO Best Practices](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)

---

## Support

For issues specific to this plugin:
1. Check the plugin logs in Strapi admin
2. Review the configuration in `config/plugins.ts`
3. Test with the demo script: `./scripts/demo-web-content-agent.sh`
4. Verify OpenAI API quota and permissions