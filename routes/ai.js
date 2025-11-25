const express = require('express');
const router = express.Router();

/**
 * POST /api/ai-predict
 * AI Match Prediction using Claude API
 */
router.post('/ai-predict', async (req, res) => {
  try {
    const { matchData } = req.body;

    if (!matchData) {
      return res.status(400).json({
        success: false,
        error: 'matchData is required'
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'API key not configured',
        message: 'ANTHROPIC_API_KEY not found in environment'
      });
    }

    const prompt = `
Bạn là chuyên gia phân tích bóng đá chuyên nghiệp. Hãy phân tích trận đấu sau và trả về JSON:

**THÔNG TIN TRẬN ĐẤU:**
- Đội nhà: ${matchData.homeTeam?.name || 'Unknown'}
- Đội khách: ${matchData.awayTeam?.name || 'Unknown'}
- Giải đấu: ${matchData.competition || 'Unknown'}
- Thời gian: ${matchData.dateTime || 'Unknown'}

**PHONG ĐỘ ĐỘI NHÀ (5 trận gần nhất):**
${matchData.homeTeam?.form || 'Không có dữ liệu'}

**PHONG ĐỘ ĐỘI KHÁCH (5 trận gần nhất):**
${matchData.awayTeam?.form || 'Không có dữ liệu'}

**YÊU CẦU PHÂN TÍCH:**
Trả về JSON với format chính xác sau (KHÔNG thêm markdown, chỉ trả JSON thuần):

{
  "winProbability": {
    "home": 45,
    "draw": 30,
    "away": 25
  },
  "predictedScore": {
    "home": 2,
    "away": 1
  },
  "keyAnalysis": [
    "Đội nhà có phong độ tốt hơn với 3/5 trận gần nhất thắng",
    "Đội khách gặp khó khăn khi làm khách (1 thắng trong 5 trận)",
    "Lịch sử đối đầu nghiêng về đội nhà",
    "Đội nhà có lợi thế sân nhà"
  ],
  "keyPlayers": [
    {
      "name": "Tên cầu thủ nổi bật đội nhà",
      "team": "home",
      "position": "FW",
      "reason": "Ghi 5 bàn trong 3 trận gần nhất"
    },
    {
      "name": "Tên cầu thủ nổi bật đội khách",
      "team": "away",
      "position": "MF",
      "reason": "Kiến tạo xuất sắc, 4 assists gần đây"
    }
  ],
  "teamComparison": {
    "attack": { "home": 75, "away": 60 },
    "defense": { "home": 70, "away": 65 },
    "form": { "home": 80, "away": 55 },
    "motivation": { "home": 70, "away": 60 }
  },
  "summary": "Đội nhà có cơ hội chiến thắng cao hơn nhờ phong độ ổn định và lợi thế sân nhà."
}

**LƯU Ý:**
- Tất cả % trong winProbability phải cộng lại = 100
- Chỉ trả JSON, KHÔNG có markdown code blocks
- keyAnalysis: 4-5 điểm quan trọng
- keyPlayers: 2-4 cầu thủ (dựa trên phong độ và vị trí quan trọng)
- teamComparison: điểm từ 0-100 cho mỗi chỉ số
- summary: 1 câu ngắn gọn, súc tích
`;

    console.log(`[AI Prediction] ${matchData.homeTeam?.name} vs ${matchData.awayTeam?.name}`);

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Anthropic API Error:', errorData);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to get prediction from Claude',
        details: errorData,
      });
    }

    const data = await response.json();
    const responseText = data.content[0]?.text || '';

    // Clean markdown if present
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    }
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
    }

    const prediction = JSON.parse(cleanedText);

    console.log(`[AI Prediction Success] ${matchData.homeTeam?.name} vs ${matchData.awayTeam?.name}`);

    res.json({
      success: true,
      data: prediction
    });

  } catch (error) {
    console.error('AI Prediction Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate prediction'
    });
  }
});

module.exports = router;
