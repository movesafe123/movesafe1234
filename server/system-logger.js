const EventEmitter = require('events');

const MAX_LOGS = 120;

/**
 * Bộ đệm vòng (Ring Buffer) lưu trữ nhật ký luồng xử lý thuật toán phía Server:
 * Đầu vào (Input) -> Các bước xử lý (Processing Steps) -> Đầu ra (Output).
 */
class SystemLogger extends EventEmitter {
  constructor() {
    super();
    this.logs = [];
    this.seq = 0;
  }

  _sanitize(value, depth = 0) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') {
      return value.length > 1500 ? value.slice(0, 1500) + '… [đã rút gọn]' : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (depth >= 4) return '[Nested Object]';

    if (Array.isArray(value)) {
      const limit = 25;
      const sliced = value.slice(0, limit).map(item => this._sanitize(item, depth + 1));
      if (value.length > limit) {
        sliced.push(`... (+${value.length - limit} phần tử nữa)`);
      }
      return sliced;
    }

    if (typeof value === 'object') {
      const out = {};
      const keys = Object.keys(value).slice(0, 35);
      for (const k of keys) {
        if (k === 'polyline' && Array.isArray(value[k])) {
          out[k] = `[${value[k].length} tọa độ]`;
        } else {
          out[k] = this._sanitize(value[k], depth + 1);
        }
      }
      return out;
    }
    return String(value);
  }

  /**
   * Ghi nhận 1 bản ghi luồng xử lý hoàn chỉnh
   */
  record({
    id = null,
    origin = 'server',
    category = 'bot',
    title = 'Xử lý thuật toán',
    source = '',
    durationMs = 0,
    status = 'success',
    input = {},
    steps = [],
    output = {},
    timestamp = null
  } = {}) {
    this.seq += 1;
    const entry = {
      id: id || `${origin}-${Date.now()}-${this.seq}`,
      timestamp: timestamp || new Date().toISOString(),
      origin: origin === 'client' ? 'client' : 'server',
      category: String(category || 'bot'),
      title: String(title || 'Xử lý thuật toán'),
      source: String(source || ''),
      durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
      status: status || 'success',
      input: this._sanitize(input),
      steps: Array.isArray(steps)
        ? steps.slice(0, 20).map((s, idx) => ({
            stepNumber: s.stepNumber || idx + 1,
            stepName: String(s.stepName || `Bước ${idx + 1}`),
            formulaOrRule: s.formulaOrRule ? String(s.formulaOrRule) : '',
            detail: String(s.detail || ''),
            metrics: this._sanitize(s.metrics || null)
          }))
        : [],
      output: this._sanitize(output)
    };

    // Chống ghi đè trùng ID khi client sync lên server
    const existingIdx = this.logs.findIndex(item => item.id === entry.id);
    if (existingIdx !== -1) {
      this.logs[existingIdx] = entry;
    } else {
      this.logs.unshift(entry);
      if (this.logs.length > MAX_LOGS) {
        this.logs.length = MAX_LOGS;
      }
    }

    this.emit('log:new', entry);
    return entry;
  }

  getLogs(limit = 60, category = null) {
    const maxCount = Math.min(MAX_LOGS, Math.max(1, parseInt(limit, 10) || 60));
    const filtered = (category && category !== 'all')
      ? this.logs.filter(item => item.category === category)
      : this.logs;
    return filtered.slice(0, maxCount);
  }

  clearLogs() {
    this.logs = [];
    this.emit('log:cleared');
    return true;
  }
}

module.exports = new SystemLogger();

