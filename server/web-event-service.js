const axios = require('axios');
const cheerio = require('cheerio');

function normalizeStr(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

// Danh mục các đầu báo chính thống, uy tín được phép trích xuất thông tin
const TRUSTED_SOURCES_WHITELIST = [
  'laodong', 'lao dong',
  'tienphong', 'tien phong',
  'vnexpress',
  'tuoitre', 'tuoi tre',
  'thanhnien', 'thanh nien', 'thanhnienviet',
  'dantri', 'dan tri',
  'baodautu', 'dau tu',
  'vov', 'vov giao thong',
  'vtv',
  'hanoimoi', 'ha noi moi',
  'vietnamnet',
  'bao giao thong', 'baogiaothong',
  'nhip song kinh doanh',
  'kinh te do thi',
  'zing', 'znews', 'tri thuc',
  'an ninh thu do', 'anninhthudo',
  'cong an', 'congan',
  'ttxvn', 'vnanet',
  'nguoi lao dong', 'nld',
  'nhan dan',
  'plo', 'phap luat',
  'kenh14'
];

// Danh mục các địa danh sự kiện trọng điểm kèm cụm từ tìm kiếm tối ưu
const URBAN_EVENT_VENUES = [
  { keywords: ['sân vận động mỹ đình', 'mỹ đình', 'svđ mỹ đình', 'sân mỹ đình'], canonicalName: 'Sân vận động Quốc gia Mỹ Đình', searchPhrase: 'sân vận động mỹ đình sự kiện', city: 'hanoi' },
  { keywords: ['trung tâm hội nghị quốc gia', 'hội nghị quốc gia', 'ncc', 'đại lộ thăng long'], canonicalName: 'Trung tâm Hội nghị Quốc gia NCC', searchPhrase: 'trung tâm hội nghị quốc gia sự kiện', city: 'hanoi' },
  { keywords: ['phố đi bộ hồ gươm', 'phố đi bộ', 'hồ gươm', 'đinh tiên hoàng', 'hoàn kiếm'], canonicalName: 'Không gian Phố đi bộ Hồ Gươm', searchPhrase: 'phố đi bộ hồ gươm sự kiện', city: 'hanoi' },
  { keywords: ['hoàng thành thăng long'], canonicalName: 'Hoàng thành Thăng Long', searchPhrase: 'hoàng thành thăng long sự kiện', city: 'hanoi' },
  { keywords: ['cung điền kinh', 'trần hữu dực'], canonicalName: 'Cung Điền kinh Hà Nội', searchPhrase: 'cung điền kinh hà nội sự kiện', city: 'hanoi' },
  { keywords: ['phố đi bộ nguyễn huệ', 'nguyễn huệ'], canonicalName: 'Phố đi bộ Nguyễn Huệ', searchPhrase: 'phố đi bộ nguyễn huệ sự kiện', city: 'hcm' },
  { keywords: ['sân vận động thống nhất', 'svđ thống nhất'], canonicalName: 'Sân vận động Thống Nhất', searchPhrase: 'sân vận động thống nhất sự kiện', city: 'hcm' },
  { keywords: ['nhà thi đấu phú thọ', 'phú thọ'], canonicalName: 'Nhà thi đấu Phú Thọ', searchPhrase: 'nhà thi đấu phú thọ sự kiện', city: 'hcm' },
  { keywords: ['công viên 29/3', 'công viên 29 tháng 3'], canonicalName: 'Công viên 29 Tháng 3', searchPhrase: 'công viên 29 tháng 3 đà nẵng sự kiện', city: 'danang' },
  { keywords: ['công viên châu á', 'asia park'], canonicalName: 'Asia Park Đà Nẵng', searchPhrase: 'asia park đà nẵng sự kiện', city: 'danang' }
];

class WebEventService {
  constructor() {
    this.cache = new Map(); // Key -> { data, expiresAt }
    this.CACHE_TTL_MS = 15 * 60 * 1000; // Lưu cache 15 phút
  }

  /**
   * Phát hiện địa điểm và từ khóa sự kiện từ câu hỏi người dùng
   */
  extractEventQueryContext(query, defaultCity = 'hanoi') {
    const lower = query.toLowerCase();

    let matchedVenue = null;
    for (const venue of URBAN_EVENT_VENUES) {
      if (venue.keywords.some(k => lower.includes(k))) {
        matchedVenue = venue;
        break;
      }
    }

    const isAskingPast = lower.includes('hôm qua') || lower.includes('tối qua') || lower.includes('vừa qua') || lower.includes('vừa rồi') || lower.includes('mới đây') || lower.includes('hôm trước');
    const isAskingCrowdOrEvent = lower.includes('đông') || lower.includes('sự kiện') || lower.includes('concert') || lower.includes('nhạc hội') || lower.includes('bóng đá') || lower.includes('giải chạy') || lower.includes('marathon') || lower.includes('lễ hội') || lower.includes('show') || lower.includes('diễn') || lower.includes('tại sao') || lower.includes('sao lại');

    return {
      matchedVenue,
      isAskingPast,
      isAskingCrowdOrEvent,
      cityName: defaultCity === 'hanoi' ? 'Hà Nội' : (defaultCity === 'hcm' ? 'TP. Hồ Chí Minh' : 'Đà Nẵng')
    };
  }

  /**
   * Tra cứu tin tức sự kiện thời gian thực qua nguồn báo chí chính thống
   */
  async searchLiveEvents(query, city = 'hanoi') {
    const ctx = this.extractEventQueryContext(query, city);
    if (!ctx.isAskingCrowdOrEvent) {
      return null;
    }

    const venueName = ctx.matchedVenue ? ctx.matchedVenue.canonicalName : query;
    const cacheKey = `${city}:${venueName.toLowerCase()}`;

    // Kiểm tra cache in-memory
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // Xây dựng cụm từ tìm kiếm tối ưu cho báo chí
    const searchTerm = ctx.matchedVenue 
      ? (ctx.matchedVenue.searchPhrase || `${ctx.matchedVenue.keywords[0]} sự kiện ${ctx.cityName}`)
      : `${query} sự kiện ${ctx.cityName}`;

    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerm)}&hl=vi&gl=VN&ceid=VN:vi`;
      const response = await axios.get(url, {
        timeout: 3500,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data, { xmlMode: true });
      const rawArticles = [];

      $('item').slice(0, 10).each((i, el) => {
        const title = $(el).find('title').text().trim();
        const pubDateStr = $(el).find('pubDate').text().trim();
        const source = $(el).find('source').text().trim();
        const description = $(el).find('description').text().replace(/<[^>]+>/g, '').trim();

        if (title && source) {
          rawArticles.push({
            title,
            pubDateStr,
            pubTime: pubDateStr ? new Date(pubDateStr).getTime() : 0,
            source,
            description
          });
        }
      });

      // ÁP DỤNG KHUNG ĐẢM BẢO CHẤT LƯỢNG THÔNG TIN (QUALITY ASSURANCE)
      const verifiedArticles = this.filterQualityNews(rawArticles, ctx);

      const result = {
        venue: ctx.matchedVenue ? ctx.matchedVenue.canonicalName : null,
        query: searchTerm,
        articlesCount: verifiedArticles.length,
        articles: verifiedArticles,
        summaryText: this.buildNewsContextSummary(verifiedArticles, ctx.matchedVenue)
      };

      // Lưu cache (chỉ lưu cache lâu khi có kết quả, không có kết quả chỉ cache 30s)
      this.cache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + (verifiedArticles.length > 0 ? this.CACHE_TTL_MS : 30 * 1000)
      });

      return result;
    } catch (err) {
      console.warn('[WebEventService] Không thể tra cứu tin tức sự kiện từ web:', err.message);
      return null;
    }
  }

  /**
   * Bộ lọc chất lượng thông tin 4 tầng: Nguồn uy tín, Thời gian, Thực thể & Từ khóa sự kiện
   */
  filterQualityNews(articles, ctx) {
    const now = Date.now();
    const maxAgeMs = ctx.isAskingPast 
      ? 10 * 24 * 60 * 60 * 1000  // Sự kiện quá khứ (hôm qua/vừa qua/cuối tuần): trong vòng 10 ngày
      : 14 * 24 * 60 * 60 * 1000; // Sự kiện sắp tới / tuần này: trong vòng 14 ngày

    const eventKeywords = [
      'concert', 'nhạc hội', 'đại nhạc hội', 'liveshow', 'bóng đá', 'khán giả', 'biển người', 
      'sốt vé', 'cháy vé', 'sự kiện', 'lễ hội', 'marathon', 'giải chạy', 'đêm nhạc', 
      'nghệ sĩ', 'ca sĩ', 'ca khúc', 'biểu diễn', 'âm nhạc', 'khuấy động', 'ùn tắc', 
      'đông nghẹt', 'đông', 'chương trình', 'hoạt động', 'văn hóa', 'hội sách', 'hội nghị', 'triển lãm'
    ];
    const venueKeywords = ctx.matchedVenue ? ctx.matchedVenue.keywords : [];

    return articles.filter(art => {
      const titleLower = art.title.toLowerCase();
      const descLower = (art.description || '').toLowerCase();
      const fullText = `${titleLower} ${descLower}`;
      const sourceNormalized = normalizeStr(art.source);

      // 1. Tiêu chí 1: Nguồn báo chí chính thống uy tín (Whitelisted High-Trust Sources)
      const isTrustedSource = TRUSTED_SOURCES_WHITELIST.some(src => sourceNormalized.includes(src));
      if (!isTrustedSource) return false;

      // 2. Tiêu chí 2: Tính thời hiệu (Temporal Recency)
      if (art.pubTime && (now - art.pubTime > maxAgeMs)) {
        return false;
      }

      // 3. Tiêu chí 3: Độ trùng khớp thực thể địa danh (Entity Relevance)
      if (venueKeywords.length > 0) {
        const matchesVenue = venueKeywords.some(k => fullText.includes(k));
        if (!matchesVenue) return false;
      }

      // 4. Tiêu chí 4: Độ trùng khớp từ khóa sự kiện / lưu lượng (Event/Crowd Signal)
      const matchesEvent = eventKeywords.some(k => fullText.includes(k));
      if (!matchesEvent) return false;

      return true;
    }).slice(0, 3); // Lấy tối đa 3 bài báo chất lượng và sát nhất
  }

  /**
   * Tạo đoạn văn bản tổng hợp tri thức báo chí để nạp trực tiếp vào ngữ cảnh AI
   */
  buildNewsContextSummary(articles, matchedVenue) {
    if (!articles || articles.length === 0) return '';

    const lines = [
      `THÔNG TIN SỰ KIỆN NÓNG THỜI GIAN THỰC TỪ BÁO CHÍ CHÍNH THỐNG${matchedVenue ? ` TẠI ${matchedVenue.canonicalName.toUpperCase()}` : ''}:`
    ];

    articles.forEach((art, idx) => {
      let timeText = 'Mới cập nhật';
      if (art.pubTime) {
        const hoursAgo = Math.round((Date.now() - art.pubTime) / (60 * 60 * 1000));
        timeText = hoursAgo < 24 ? `${hoursAgo} giờ trước` : `${Math.round(hoursAgo / 24)} ngày trước`;
      }
      lines.push(`${idx + 1}. [${art.source} - ${timeText}]: "${art.title}"`);
      if (art.description && art.description.length > 15) {
        lines.push(`   Chi tiết: ${art.description.replace(/\s+/g, ' ').slice(0, 200)}...`);
      }
    });

    return lines.join('\n');
  }
}

module.exports = new WebEventService();
