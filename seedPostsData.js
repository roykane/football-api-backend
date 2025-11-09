// Seed sample data for posts and categories
const mongoose = require('mongoose');
require('dotenv').config();

const Category = require('./models/Category');
const Post = require('./models/Post');

const seedData = async () => {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/football-odds';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data
    await Category.deleteMany({});
    await Post.deleteMany({});
    console.log('🗑️  Cleared existing data\n');

    // Create categories
    const categories = await Category.insertMany([
      {
        title: 'Tin Tức Bóng Đá',
        slug: 'tin-tuc-bong-da',
        type: 'news',
        description: 'Tin tức bóng đá mới nhất',
        order: 1,
        status: 'active',
      },
      {
        title: 'Tỷ Lệ Kèo',
        slug: 'ty-le-keo',
        type: 'odds',
        description: 'Phân tích tỷ lệ kèo',
        order: 2,
        status: 'active',
      },
      {
        title: 'Phân Tích Trận Đấu',
        slug: 'phan-tich-tran-dau',
        type: 'analysis',
        description: 'Phân tích chi tiết trận đấu',
        order: 3,
        status: 'active',
      },
      {
        title: 'Bình Luận Bóng Đá',
        slug: 'binh-luan-bong-da',
        type: 'news',
        description: 'Bình luận và nhận định',
        order: 4,
        status: 'active',
      },
      {
        title: 'Dự Đoán Tỷ Số',
        slug: 'du-doan-ty-so',
        type: 'odds',
        description: 'Dự đoán tỷ số các trận đấu',
        order: 5,
        status: 'active',
      },
    ]);

    console.log(`✅ Created ${categories.length} categories`);

    // Create sample posts
    const samplePosts = [
      {
        title: 'Manchester United vs Liverpool: Trận cầu đinh vòng 10 Premier League',
        slug: 'manchester-united-vs-liverpool-vong-10-premier-league',
        excerpt: 'Phân tích chi tiết trận đấu giữa Man Utd và Liverpool tại Old Trafford',
        content: 'Nội dung bài viết về trận đấu giữa Manchester United và Liverpool...',
        category: categories[0]._id,
        status: 'published',
        author: 'Admin',
        tags: ['Premier League', 'Man Utd', 'Liverpool'],
      },
      {
        title: 'Tỷ lệ kèo Real Madrid vs Barcelona: Nhà cái đánh giá cao Barca',
        slug: 'ty-le-keo-real-madrid-vs-barcelona',
        excerpt: 'Phân tích tỷ lệ kèo trận El Clasico',
        content: 'Nội dung phân tích tỷ lệ kèo trận đấu...',
        category: categories[1]._id,
        status: 'published',
        author: 'Admin',
        tags: ['La Liga', 'Real Madrid', 'Barcelona', 'Tỷ lệ kèo'],
      },
      {
        title: 'Bayern Munich thắng áp đảo: Phong độ đáng sợ ở Bundesliga',
        slug: 'bayern-munich-phong-do-dang-so-bundesliga',
        excerpt: 'Bayern đang có chuỗi thành tích ấn tượng',
        content: 'Nội dung bài viết về phong độ của Bayern...',
        category: categories[2]._id,
        status: 'published',
        author: 'Admin',
        tags: ['Bundesliga', 'Bayern Munich'],
      },
      {
        title: 'Cristiano Ronaldo ghi bàn thứ 900 trong sự nghiệp',
        slug: 'cristiano-ronaldo-ghi-ban-thu-900',
        excerpt: 'Cột mốc lịch sử của CR7',
        content: 'Nội dung về cột mốc 900 bàn thắng...',
        category: categories[0]._id,
        status: 'published',
        author: 'Admin',
        tags: ['Cristiano Ronaldo', 'Kỷ lục'],
      },
      {
        title: 'Dự đoán tỷ số Arsenal vs Chelsea: The Gunners có lợi thế',
        slug: 'du-doan-ty-so-arsenal-vs-chelsea',
        excerpt: 'Nhận định và dự đoán tỷ số trận derby London',
        content: 'Nội dung dự đoán tỷ số...',
        category: categories[4]._id,
        status: 'published',
        author: 'Admin',
        tags: ['Premier League', 'Arsenal', 'Chelsea', 'Dự đoán'],
      },
      {
        title: 'Kèo châu Á PSG vs Monaco: Chủ nhà được đánh giá cao',
        slug: 'keo-chau-a-psg-vs-monaco',
        excerpt: 'Phân tích kèo châu Á trận đấu tại Parc des Princes',
        content: 'Nội dung phân tích kèo châu Á...',
        category: categories[1]._id,
        status: 'published',
        author: 'Admin',
        tags: ['Ligue 1', 'PSG', 'Monaco', 'Kèo châu Á'],
      },
      {
        title: 'Inter Milan vs AC Milan: Phân tích Derby della Madonnina',
        slug: 'inter-milan-vs-ac-milan-derby-della-madonnina',
        excerpt: 'Trận derby Milan sôi động',
        content: 'Nội dung phân tích derby Milan...',
        category: categories[2]._id,
        status: 'published',
        author: 'Admin',
        tags: ['Serie A', 'Inter Milan', 'AC Milan', 'Derby'],
      },
      {
        title: 'Top 10 bàn thắng đẹp nhất tuần qua',
        slug: 'top-10-ban-thang-dep-nhat-tuan-qua',
        excerpt: 'Điểm lại những bàn thắng ấn tượng',
        content: 'Nội dung về top 10 bàn thắng đẹp...',
        category: categories[3]._id,
        status: 'published',
        author: 'Admin',
        tags: ['Highlights', 'Bàn thắng đẹp'],
      },
    ];

    const posts = await Post.insertMany(samplePosts);
    console.log(`✅ Created ${posts.length} posts\n`);

    console.log('✅ Seed data complete!');
    console.log('\n📊 Summary:');
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Posts: ${posts.length}`);
    console.log(`\n🔗 API Endpoints:`);
    console.log(`   GET http://localhost:5000/api/posts`);
    console.log(`   GET http://localhost:5000/api/categories`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
