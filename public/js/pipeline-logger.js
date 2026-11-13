/**
 * MoveSafe VN - Client Pipeline Logger
 * Ghi nhận ngầm luồng Đầu vào -> Xử lý -> Đầu ra của các thuật toán Frontend
 * và phát thời gian thực sang trang ẩn (/system-log) qua BroadcastChannel + localStorage + API Server.
 */
(function () {
  // Đảm bảo window.getApiUrl khả dụng ngay cả trên trang độc lập pipeline-log.html (GitHub Pages -> Cloud Render)
  if (typeof window !== 'undefined' && typeof window.getApiUrl !== 'function') {
    window.MOVESAFE_API_URL = localStorage.getItem('movesafe_api_url') || 'https://movesafe1234.onrender.com';
    window.getApiUrl = function (endpoint) {
      if (!endpoint) return '';
      var cleanPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
      var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname.includes('github.io');
      if (isLocal) return cleanPath;
      var base = (window.MOVESAFE_API_URL || 'https://movesafe1234.onrender.com').replace(/\/+$/, '');
      return base + cleanPath;
    };
  }

  const STORAGE_KEY = 'movesafe_pipeline_logs_v1';
  const CHANNEL_NAME = 'movesafe_pipeline_log';
  const MAX_LOCAL_LOGS = 60;

  class ClientPipelineLogger {
    constructor() {
      this.seq = 0;
      this.listeners = new Set();
      this.channel = (typeof BroadcastChannel !== 'undefined')
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;

      if (this.channel) {
        this.channel.onmessage = (ev) => {
          const msg = ev && ev.data;
          if (!msg) return;
          if (msg.type === 'log:new' && msg.entry) {
            this._notifyListeners('log:new', msg.entry);
          } else if (msg.type === 'log:cleared') {
            this._notifyListeners('log:cleared', null);
          }
        };
      }

      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (ev) => {
          if (ev.key === STORAGE_KEY) {
            this._notifyListeners('log:sync', this.getLocalLogs());
          }
        });
      }
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

    getLocalLogs() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (_e) {
        return [];
      }
    }

    _saveLocalLogs(list) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_LOCAL_LOGS)));
      } catch (_e) {
        // Nếu đầy bộ nhớ, cắt bớt một nửa rồi lưu lại
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 20)));
        } catch (_e2) {}
      }
    }

    _notifyListeners(eventType, payload) {
      this.listeners.forEach(fn => {
        try { fn(eventType, payload); } catch (_e) {}
      });
    }

    subscribe(fn) {
      if (typeof fn === 'function') {
        this.listeners.add(fn);
      }
      return () => this.listeners.delete(fn);
    }

    log({
      category = 'routing',
      title = 'Thực thi thuật toán',
      source = '',
      durationMs = 0,
      status = 'success',
      input = {},
      steps = [],
      output = {},
      syncToServer = true
    } = {}) {
      this.seq += 1;
      const entry = {
        id: `cli-${Date.now()}-${this.seq}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        origin: 'client',
        category: String(category || 'routing'),
        title: String(title || 'Thực thi thuật toán'),
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

      const current = this.getLocalLogs();
      current.unshift(entry);
      if (current.length > MAX_LOCAL_LOGS) current.length = MAX_LOCAL_LOGS;
      this._saveLocalLogs(current);

      if (this.channel) {
        try {
          this.channel.postMessage({ type: 'log:new', entry });
        } catch (_e) {}
      }

      this._notifyListeners('log:new', entry);

      if (syncToServer && typeof fetch === 'function') {
        const apiUrl = (typeof window !== 'undefined' && typeof window.getApiUrl === 'function')
          ? window.getApiUrl('/api/system-logs/client')
          : '/api/system-logs/client';
        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
          keepalive: true
        }).catch(() => {});
      }

      return entry;
    }

    clear() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_e) {}
      if (this.channel) {
        try {
          this.channel.postMessage({ type: 'log:cleared' });
        } catch (_e) {}
      }
      this._notifyListeners('log:cleared', null);
    }
  }

  if (typeof window !== 'undefined') {
    window.moveSafeLogger = window.moveSafeLogger || new ClientPipelineLogger();
  }
})();

