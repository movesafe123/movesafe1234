/**
 * ============================================================================
 * MOVESAFE VN - AUTOMATED TEST SUITE: UNIT TESTING
 * Module: Web Event Service & Live Urban Event Grounding
 * Reference Prefix: TC-EVT (Events & Urban Intelligence)
 * ============================================================================
 */

const { describe, it } = require('node:test');
const assert = require('assert');
const webEventService = require('../../server/web-event-service');
const aiService = require('../../server/ai-service');

describe('Module TC-EVT: Web Event Service & Quality Assurance', () => {

  // TC-EVT-001: Bóc tách ngữ cảnh địa danh và ý định sự kiện
  it('[TC-EVT-001] Venue and temporal event intent are extracted accurately', () => {
    const ctx1 = webEventService.extractEventQueryContext('hôm qua sân vận động mỹ đình lúc 8h tối đông thế', 'hanoi');
    assert.strictEqual(ctx1.matchedVenue?.canonicalName, 'Sân vận động Quốc gia Mỹ Đình');
    assert.strictEqual(ctx1.isAskingPast, true);
    assert.strictEqual(ctx1.isAskingCrowdOrEvent, true);

    const ctx2 = webEventService.extractEventQueryContext('phố đi bộ hồ gươm cuối tuần này có sự kiện gì đông không', 'hanoi');
    assert.strictEqual(ctx2.matchedVenue?.canonicalName, 'Không gian Phố đi bộ Hồ Gươm');
    assert.strictEqual(ctx2.isAskingCrowdOrEvent, true);
  });

  // TC-EVT-002: Bộ lọc 4 tầng loại bỏ nguồn không uy tín và tin tức hết hạn
  it('[TC-EVT-002] 4-tier quality assurance filters out unverified sources and stale news', () => {
    const mockContext = {
      matchedVenue: { keywords: ['mỹ đình'], canonicalName: 'Sân vận động Quốc gia Mỹ Đình' },
      isAskingPast: true
    };

    const articles = [
      // Bài 1: Nguồn rác / không trong whitelist -> Phải bị loại
      { title: 'Tin đồn concert Mỹ Đình', pubTime: Date.now() - 3600000, source: 'BlogCaNhan123.com', description: 'mỹ đình concert' },
      // Bài 2: Tin quá cũ (30 ngày trước) -> Phải bị loại
      { title: 'Concert Mỹ Đình tháng trước', pubTime: Date.now() - (30 * 24 * 60 * 60 * 1000), source: 'Báo Lao Động', description: 'mỹ đình concert' },
      // Bài 3: Tin không có từ khóa sự kiện -> Phải bị loại
      { title: 'Mua bán nhà đất gần sân Mỹ Đình giá rẻ', pubTime: Date.now() - 3600000, source: 'Báo Tiền Phong', description: 'mỹ đình bất động sản' },
      // Bài 4: Hợp lệ 100% -> Phải được giữ lại
      { title: 'Concert BigBang tại sân vận động Mỹ Đình thu hút biển người', pubTime: Date.now() - 7200000, source: 'Báo Lao Động', description: 'mỹ đình đại nhạc hội' }
    ];

    const filtered = webEventService.filterQualityNews(articles, mockContext);
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].title, 'Concert BigBang tại sân vận động Mỹ Đình thu hút biển người');
    assert.strictEqual(filtered[0].source, 'Báo Lao Động');
  });

  // TC-EVT-003: Tra cứu trực tuyến tin tức sự kiện thực tế
  it('[TC-EVT-003] Live web event search returns verified news articles with high speed', async () => {
    const res = await webEventService.searchLiveEvents('hôm qua sân vận động mỹ đình lúc 8h tối đông thế', 'hanoi');
    assert.ok(res !== null, 'Event result should not be null');
    assert.strictEqual(res.venue, 'Sân vận động Quốc gia Mỹ Đình');
    assert.ok(res.articlesCount >= 1, 'Should find at least 1 verified news article');
    assert.ok(res.summaryText.includes('THÔNG TIN SỰ KIỆN NÓNG'));
    assert.ok(res.articles[0].source.length > 0);
  });

  // TC-EVT-004: Tích hợp tri thức báo chí vào câu trả lời của AI Assistant
  it('[TC-EVT-004] AI Assistant incorporates live news articles into responses with citations', async () => {
    const res = await aiService.processQuery({
      query: 'hôm qua sân vận động mỹ đình lúc 8h tối đông thế',
      city: 'hanoi'
    });

    assert.ok(res.text.includes('Sân vận động Quốc gia Mỹ Đình') || res.text.includes('Mỹ Đình'));
    assert.ok(
      res.text.includes('báo chí chính thống') ||
      res.text.includes('Lao Động') ||
      res.text.includes('BigBang') ||
      res.text.includes('Concert') ||
      res.text.includes('đại nhạc hội')
    );
    assert.strictEqual(res.text.includes('Đặc điểm thoát nước: Đường Trần Bình'), false);
  });
});

