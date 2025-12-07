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
Hãy PHÂN TÍCH KỸ LƯỠNG dữ liệu phong độ và đưa ra dự đoán THỰC TẾ, KHÁCH QUAN.

Trả về JSON với format chính xác sau (KHÔNG thêm markdown, chỉ trả JSON thuần):

{
  "winProbability": {
    "home": <số từ 0-100, phân tích dựa vào phong độ thực tế>,
    "draw": <số từ 0-100>,
    "away": <số từ 0-100>
  },
  "predictedScore": {
    "home": <dự đoán số bàn thắng dựa vào phong độ ghi bàn>,
    "away": <dự đoán số bàn thắng dựa vào phong độ ghi bàn>
  },
  "keyAnalysis": [
    "<phân tích chi tiết về phong độ gần đây>",
    "<phân tích về khả năng ghi bàn/thủ môn>",
    "<phân tích về lợi thế sân nhà/khách>",
    "<phân tích về động lực, mục tiêu của từng đội>"
  ],
  "keyPlayers": [
    {
      "name": "<tên cầu thủ nổi bật nếu có thông tin>",
      "team": "home hoặc away",
      "position": "FW/MF/DF/GK",
      "reason": "<lý do dựa trên phong độ hoặc vị trí quan trọng>"
    }
  ],
  "teamComparison": {
    "attack": { "home": <0-100>, "away": <0-100> },
    "defense": { "home": <0-100>, "away": <0-100> },
    "form": { "home": <0-100>, "away": <0-100> },
    "motivation": { "home": <0-100>, "away": <0-100> }
  },
  "summary": "<tóm tắt dự đoán 1-2 câu>"
}

**LƯU Ý QUAN TRỌNG:**
- PHẢI phân tích PHONG ĐỘ thực tế (W=thắng, D=hòa, L=thua) để đưa ra dự đoán
- Tỷ số dự đoán PHẢI DỰA VÀO khả năng ghi bàn thực tế, KHÔNG copy example
- Tất cả % trong winProbability phải cộng lại = 100
- Chỉ trả JSON thuần, KHÔNG có markdown code blocks
- keyAnalysis: 4-5 điểm phân tích cụ thể
- keyPlayers: 2-4 cầu thủ nếu có thể suy luận từ phong độ (hoặc để trống nếu không đủ dữ liệu)
- teamComparison: điểm từ 0-100 cho mỗi chỉ số dựa vào phong độ
- summary: 1-2 câu ngắn gọn, súc tích
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
