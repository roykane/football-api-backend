const Parser = require('rss-parser');
const Article = require('../models/Article');
require('dotenv').config();

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media'],
      ['media:thumbnail', 'thumbnail'],
    ],
  },
});

// RSS Sources
const RSS_SOURCES = [
  {
    name: 'VnExpress',
    url: 'https://vnexpress.net/rss/bong-da.rss',
    category: 'general',
  },
  {
    name: 'Bóng Đá 24h',
    url: 'https://bongda24h.vn/feed',
    category: 'general',
  },
  {
    name: '24h Sport',
    url: 'https://www.24h.com.vn/upload/rss/bongda.rss',
    category: 'general',
  },
  {
    name: 'Thể Thao 247',
    url: 'https://thethao247.vn/rss/bong-da.rss',
    category: 'general',
  },
  {
    name: 'Bóng Đá Plus',
    url: 'https://bongdaplus.vn/rss/tin-tuc.rss',
    category: 'analysis',
  },
];

/**
 * Extract image from RSS item
 */
function extractImage(item) {
  // Try media:content
  if (item.media?.$ && item.media.$.url) {
    return item.media.$.url;
  }

  // Try media:thumbnail
  if (item.thumbnail?.$ && item.thumbnail.$.url) {
    return item.thumbnail.$.url;
  }

  // Try enclosure
  if (item.enclosure?.url) {
    return item.enclosure.url;
  }

  // Try to extract from content
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  return null;
}

/**
 * Generate AI content using Claude API
 */
async function generateAIContent(title, originalDescription, source) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = `Bạn là một chuyên gia phân tích bóng đá chuyên nghiệp, viết bài cho trang tin tức thể thao.

Nhiệm vụ: Dựa vào tiêu đề tin tức bóng đá sau, hãy viết một bài báo CHI TIẾT, CHUYÊN NGHIỆP.

Tiêu đề: "${title}"
${originalDescription ? `Thông tin gốc: "${originalDescription}"` : ''}
${source ? `Nguồn: ${source}` : ''}

Yêu cầu:
1. **Title**: Viết lại tiêu đề hấp dẫn hơn (50-70 ký tự)
2. **Description**: Tóm tắt ngắn gọn (120-160 ký tự) cho meta description
3. **Content**: Viết bài báo đầy đủ với:
   - Đoạn mở đầu hấp dẫn
   - 3-5 đoạn văn phân tích chi tiết
   - Thông tin về đội bóng, cầu thủ liên quan
   - Phân tích chiến thuật nếu có
   - Ý nghĩa của sự kiện này
   - Kết luận
4. **Tags**: 5-7 tags liên quan

Format trả về (CHÍNH XÁC):
---TITLE---
[Tiêu đề mới]

---DESCRIPTION---
[Mô tả ngắn]

---CONTENT---
[Nội dung đầy đủ với các đoạn văn, sử dụng markdown]

---TAGS---
tag1, tag2, tag3, tag4, tag5

Lưu ý:
- Viết bằng tiếng Việt tự nhiên, chuyên nghiệp
- Nội dung phải chi tiết ít nhất 300-500 từ
- Dùng markdown cho format (##, **, -, etc.)
- Đừng bịa đặt thông tin, dựa vào kiến thức về bóng đá
- Giữ giọng văn khách quan, phân tích`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[API Error] Status:', response.status);
      console.error('[API Error] Full response:', JSON.stringify(errorData, null, 2));
      throw new Error(errorData.error?.message || JSON.stringify(errorData) || 'Failed to generate content');
    }

    const data = await response.json();
    const responseText = data.content[0].text;

    // Parse response
    const titleMatch = responseText.match(/---TITLE---\s*([\s\S]*?)\s*---DESCRIPTION---/);
    const descMatch = responseText.match(/---DESCRIPTION---\s*([\s\S]*?)\s*---CONTENT---/);
    const contentMatch = responseText.match(/---CONTENT---\s*([\s\S]*?)\s*---TAGS---/);
    const tagsMatch = responseText.match(/---TAGS---\s*([\s\S]*?)$/);

    return {
      title: titleMatch ? titleMatch[1].trim() : title,
      description: descMatch ? descMatch[1].trim() : originalDescription || '',
      content: contentMatch ? contentMatch[1].trim() : '',
      tags: tagsMatch
        ? tagsMatch[1]
            .trim()
            .split(',')
            .map(t => t.trim())
        : [],
    };
  } catch (error) {
    console.error('[AI Generation Error]:', error);
    throw error;
  }
}

/**
 * Fetch RSS feed and return items
 */
async function fetchRSSFeed(source) {
  try {
    console.log(`[RSS] Fetching from ${source.name}...`);
    const feed = await parser.parseURL(source.url);

    const items = feed.items.map(item => ({
      originalTitle: item.title || 'Untitled',
      originalDescription: item.contentSnippet || item.summary || '',
      originalLink: item.link || '',
      image: extractImage(item),
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source: source.name,
      category: source.category,
    }));

    console.log(`[RSS] ✅ Fetched ${items.length} items from ${source.name}`);
    return items;
  } catch (error) {
    console.error(`[RSS] ❌ Failed to fetch from ${source.name}:`, error.message);
    return [];
  }
}

/**
 * Generate and save article to database
 */
async function processAndSaveArticle(rssItem) {
  try {
    // Check if article already exists
    const exists = await Article.existsByOriginalTitle(rssItem.originalTitle);
    if (exists) {
      console.log(`[Skip] Article already exists: "${rssItem.originalTitle.substring(0, 50)}..."`);
      return null;
    }

    console.log(`[AI] Generating content for: "${rssItem.originalTitle.substring(0, 50)}..."`);

    // Generate AI content
    const aiContent = await generateAIContent(
      rssItem.originalTitle,
      rssItem.originalDescription,
      rssItem.source
    );

    // If no image from RSS, use random fallback image
    if (!rssItem.image) {
      rssItem.image = FOOTBALL_IMAGES[Math.floor(Math.random() * FOOTBALL_IMAGES.length)];
    }

    // Save to database
    const article = new Article({
      ...rssItem,
      ...aiContent,
      status: 'published',
      generatedAt: new Date(),
    });

    await article.save();

    console.log(`[DB] ✅ Saved: "${article.title}"`);
    return article;
  } catch (error) {
    console.error(`[Error] Failed to process article:`, error.message);
    return null;
  }
}

// Fallback topics when RSS feeds fail
const FALLBACK_TOPICS = [
  { title: 'Phân tích chiến thuật Premier League mùa giải mới', category: 'analysis' },
  { title: 'Top 10 cầu thủ xuất sắc nhất Champions League', category: 'general' },
  { title: 'Chuyển nhượng: Những thương vụ đình đám nhất hè này', category: 'transfer' },
  { title: 'Real Madrid vs Barcelona: El Clasico kinh điển sắp tới', category: 'analysis' },
  { title: 'Erling Haaland: Cỗ máy ghi bàn của Manchester City', category: 'general' },
  { title: 'Kylian Mbappe và tương lai tại PSG', category: 'transfer' },
  { title: 'Liverpool xây dựng lại đội hình với HLV Klopp', category: 'analysis' },
  { title: 'Serie A: AC Milan và Inter tranh ngôi vương', category: 'general' },
  { title: 'Bundesliga: Bayern Munich có tiếp tục thống trị?', category: 'analysis' },
  { title: 'La Liga: Cuộc đua tam mã giữa Real, Barca và Atletico', category: 'general' },
  { title: 'Lịch sử các trận chung kết Champions League kinh điển', category: 'general' },
  { title: 'Thế hệ tài năng trẻ đang lên của bóng đá Anh', category: 'general' },
  { title: 'Chiến thuật pressing hiện đại trong bóng đá', category: 'analysis' },
  { title: 'Son Heung-min: Niềm tự hào của bóng đá châu Á', category: 'general' },
  { title: 'Manchester United tìm lại ánh hào quang', category: 'analysis' },
];

// Real football images from Unsplash
const FOOTBALL_IMAGES = [
  'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800',
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800',
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800',
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
  'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=800',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800',
  'https://images.unsplash.com/photo-1511886929837-354d827aae26?w=800',
  'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800',
  'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=800',
  'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800',
  'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800',
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800',
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
  'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800',
];

/**
 * Generate article from fallback topic (when RSS fails)
 */
async function generateFromFallbackTopic(topic) {
  try {
    console.log(`[Fallback] Generating: "${topic.title}"`);

    const aiContent = await generateAIContent(
      topic.title,
      'Bài viết được tạo tự động bởi AI dựa trên chủ đề bóng đá phổ biến',
      'AI Generated'
    );

    // Pick a random image from the real football images
    const randomImage = FOOTBALL_IMAGES[Math.floor(Math.random() * FOOTBALL_IMAGES.length)];

    const article = new Article({
      originalTitle: topic.title,
      originalDescription: 'AI Generated Content',
      source: 'AI Generated',
      category: topic.category,
      image: randomImage,
      ...aiContent,
      status: 'published',
      generatedAt: new Date(),
      pubDate: new Date().toISOString(),
    });

    await article.save();
    console.log(`[Fallback] ✅ Created: "${article.title}"`);
    return article;
  } catch (error) {
    console.error(`[Fallback] ❌ Failed:`, error.message);
    return null;
  }
}

/**
 * Main auto-generation process
 */
async function runAutoNewsGeneration(maxArticles = 5) {
  console.log('\n🤖 ========== AUTO NEWS GENERATION START ==========');
  console.log(`📅 Time: ${new Date().toLocaleString('vi-VN')}`);
  console.log(`🎯 Target: ${maxArticles} new articles\n`);

  const startTime = Date.now();
  let totalGenerated = 0;

  try {
    // Fetch from all RSS sources
    const allPromises = RSS_SOURCES.map(source => fetchRSSFeed(source));
    const results = await Promise.allSettled(allPromises);

    // Combine all RSS items
    const allRSSItems = [];
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allRSSItems.push(...result.value);
      }
    });

    console.log(`\n[RSS] Total items fetched: ${allRSSItems.length}`);

    // Sort by pubDate (newest first)
    allRSSItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Process RSS items first
    for (const rssItem of allRSSItems) {
      if (totalGenerated >= maxArticles) {
        break;
      }

      const article = await processAndSaveArticle(rssItem);

      if (article) {
        totalGenerated++;
      }

      // Rate limiting: wait 2 seconds between AI requests
      if (totalGenerated < maxArticles) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // If not enough articles from RSS, use fallback topics
    if (totalGenerated < maxArticles) {
      console.log(`\n⚠️  RSS feeds returned insufficient items (${allRSSItems.length})`);
      console.log(`🔄 Generating ${maxArticles - totalGenerated} articles from fallback topics...\n`);

      // Shuffle fallback topics
      const shuffledTopics = [...FALLBACK_TOPICS].sort(() => Math.random() - 0.5);

      for (let i = 0; i < shuffledTopics.length && totalGenerated < maxArticles; i++) {
        const article = await generateFromFallbackTopic(shuffledTopics[i]);

        if (article) {
          totalGenerated++;
        }

        // Rate limiting
        if (totalGenerated < maxArticles) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n✅ ========== AUTO NEWS GENERATION COMPLETE ==========');
    console.log(`📊 Articles Generated: ${totalGenerated}/${maxArticles}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📅 Completed at: ${new Date().toLocaleString('vi-VN')}\n`);

    return {
      success: true,
      generated: totalGenerated,
      duration,
    };
  } catch (error) {
    console.error('\n❌ ========== AUTO NEWS GENERATION FAILED ==========');
    console.error('Error:', error);
    return {
      success: false,
      generated: totalGenerated,
      error: error.message,
    };
  }
}

/**
 * Manual trigger for testing
 */
async function generateSingleArticle(title, description, source, category = 'general') {
  try {
    const aiContent = await generateAIContent(title, description, source);

    const article = new Article({
      originalTitle: title,
      originalDescription: description,
      source,
      category,
      ...aiContent,
      status: 'published',
      generatedAt: new Date(),
    });

    await article.save();

    console.log(`[Manual] ✅ Article created: "${article.title}"`);
    return article;
  } catch (error) {
    console.error('[Manual] ❌ Failed to create article:', error);
    throw error;
  }
}

module.exports = {
  runAutoNewsGeneration,
  generateSingleArticle,
};
