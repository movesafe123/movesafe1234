#!/usr/bin/env node
/**
 * rebuild-evcs-outputs.js - Đồng bộ tập 1.141 trạm EVCS.VN (evcs-*) ra JSON, CSV, Cache & Public
 * RÀNG BUỘC AN TOÀN: Không bao giờ thay đổi tọa độ (lat/lng) hoặc metadata của 220 trạm nền cũ (non-evcs-*).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function nfcDeep(val) {
  if (typeof val === 'string') return val.normalize('NFC');
  if (Array.isArray(val)) return val.map(nfcDeep);
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = nfcDeep(v);
    }
    return out;
  }
  return val;
}

function csvEscape(v) {
  const s = String(v ?? '').normalize('NFC').replace(/"/g, '""');
  return `"${s}"`;
}

function rebuildEvcsOutputs({ syncPublic = true } = {}) {
  process.env.BOT_DISABLE_AUTO_INIT = '1';

  const evcsJsonPath = path.join(ROOT, 'data', 'evcs_hanoi_stations.json');
  const evcsCsvPath = path.join(ROOT, 'data', 'evcs_hanoi_stations.csv');
  const cachePath = path.join(ROOT, 'data', 'ev_stations_cache.json');

  const evcsList = JSON.parse(fs.readFileSync(evcsJsonPath, 'utf8')).map(nfcDeep);
  fs.writeFileSync(evcsJsonPath, (JSON.stringify(evcsList, null, 2) + '\n').normalize('NFC'), 'utf8');

  const csvHeader = 'id,loai_tram,khu_vuc,quan_huyen,ten_tram,hang,dia_chi,lat,lng,cong_suat_max_kw,so_cong_hoac_pin,trang_thai,thong_tin_cong,nguon_toa_do,chat_luong_gps,ghi_chu_gps';
  const csvRows = [csvHeader];
  for (const s of evcsList) {
    const connStr = (s.connectors || []).map(c => `${c.type} (${c.quantity || 1})`).join('; ');
    csvRows.push([
      csvEscape(s.id),
      csvEscape(s.stationKindLabel || (s.stationKind === 'battery_swap' ? 'Trạm đổi pin' : 'Trạm sạc xe điện')),
      csvEscape(s.area || ''),
      csvEscape(s.district || ''),
      csvEscape(s.name || ''),
      csvEscape(s.operator || ''),
      csvEscape(s.address || ''),
      csvEscape(s.lat),
      csvEscape(s.lng),
      csvEscape(s.maxPowerKw ?? ''),
      csvEscape(s.totalPoints ?? ''),
      csvEscape(s.statusText || ''),
      csvEscape(connStr),
      csvEscape(s.coordSource || ''),
      csvEscape(s.geoQuality || 'verified'),
      csvEscape(s.geoIssue || '')
    ].join(','));
  }
  fs.writeFileSync(evcsCsvPath, '\uFEFF' + csvRows.join('\r\n').normalize('NFC') + '\r\n', 'utf8');

  // Nạp lại ev-service sau khi bật BOT_DISABLE_AUTO_INIT
  const evService = require(path.join(ROOT, 'server', 'ev-service'));
  const currentCache = JSON.parse(fs.readFileSync(cachePath, 'utf8')).map(nfcDeep);

  // Giữ nguyên 100% các trạm nền cũ (non-evcs-*), chụp snapshot bất biến
  const baseNonEvcs = currentCache
    .filter(s => !String(s.id || '').startsWith('evcs-'))
    .map(s => nfcDeep(s));

  const legacySnapshot = baseNonEvcs.map(s => ({
    lat: s.lat,
    lng: s.lng,
    name: s.name,
    address: s.address,
    operator: s.operator,
    city: s.city,
    stationKind: s.stationKind,
    stationKindLabel: s.stationKindLabel,
    maxPowerKw: s.maxPowerKw,
    connectors: s.connectors
  }));

  const merged = baseNonEvcs.map(s => ({ ...s }));
  let matchedLegacy = 0;
  let addedEvcs = 0;

  for (const st of evcsList) {
    const incoming = nfcDeep({
      ...st,
      verifiedSources: Array.isArray(st.verifiedSources) && st.verifiedSources.length > 0 ? st.verifiedSources : ['EVCS.VN']
    });

    let matchIdx = -1;
    for (let i = 0; i < baseNonEvcs.length; i++) {
      if (evService.shouldMergeStations(merged[i], incoming)) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx >= 0) {
      evService.enrichExistingStation(merged[matchIdx], incoming, null);
      // Khôi phục tuyệt đối tọa độ và thông tin gốc của trạm nền cũ (non-evcs-*)
      Object.assign(merged[matchIdx], legacySnapshot[matchIdx]);
      matchedLegacy++;
    } else {
      merged.push(incoming);
      addedEvcs++;
    }
  }

  evService.stations = merged;
  evService.lastSyncTime = Date.now();
  evService.saveToCache();

  if (syncPublic) {
    const filesToSync = [
      ['data/evcs_hanoi_stations.json', 'public/data/evcs_hanoi_stations.json'],
      ['data/evcs_hanoi_stations.csv', 'public/data/evcs_hanoi_stations.csv'],
      ['data/ev_stations_cache.json', 'public/data/ev_stations_cache.json'],
      ['js/ev-stations-data.js', 'public/js/ev-stations-data.js']
    ];
    for (const [srcRel, dstRel] of filesToSync) {
      const src = path.join(ROOT, srcRel);
      const dst = path.join(ROOT, dstRel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }

  return {
    evcsCount: evcsList.length,
    totalCache: merged.length,
    legacyCount: baseNonEvcs.length,
    matchedLegacy,
    addedEvcs
  };
}

if (require.main === module) {
  const res = rebuildEvcsOutputs({ syncPublic: true });
  console.log('[rebuild-evcs-outputs] Hoàn tất:', JSON.stringify(res));
}

module.exports = { rebuildEvcsOutputs, nfcDeep };
