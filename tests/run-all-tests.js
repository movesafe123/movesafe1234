/**
 * ============================================================================
 * MOVESAFE VN - MASTER TEST RUNNER & TEST METRICS RECORDER
 * Collects execution results across Unit, Integration and E2E suites
 * Outputs JSON metrics to tests/test-results.json
 * ============================================================================
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const testSuites = [
  { file: 'tests/unit/routing-engine.test.js', category: 'Unit: Thuật toán Dẫn đường Né ngập', prefix: 'TC-NAV' },
  { file: 'tests/unit/weather-parser.test.js', category: 'Unit: Dữ liệu Khí tượng & Cảnh báo', prefix: 'TC-WTH' },
  { file: 'tests/api/server-api.test.js', category: 'Integration: Backend REST API & Bảo mật', prefix: 'TC-API' },
  { file: 'tests/e2e/browser-e2e.test.js', category: 'E2E: Trải nghiệm Người dùng & Giao diện Bản đồ', prefix: 'TC-E2E' }
];

async function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = spawn(cmd, args, { shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      resolve({ code, stdout, stderr, durationMs });
    });
  });
}

function parseTestOutput(stdout) {
  const tests = [];
  const lines = stdout.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    const passMatch = trimmed.match(/^✔\s+(\[TC-[^\]]+\]\s+.*)\s+\(([\d.]+)ms\)/);
    const failMatch = trimmed.match(/^✖\s+(\[TC-[^\]]+\]\s+.*)\s+\(([\d.]+)ms\)/);

    if (passMatch) {
      const fullTitle = passMatch[1];
      const durationMs = parseFloat(passMatch[2]);
      const idMatch = fullTitle.match(/\[(TC-[^\]]+)\]/);
      const testId = idMatch ? idMatch[1] : 'TC-GEN';
      const title = fullTitle.replace(/\[TC-[^\]]+\]\s*/, '');

      tests.push({
        id: testId,
        title,
        status: 'PASSED',
        durationMs
      });
    } else if (failMatch) {
      const fullTitle = failMatch[1];
      const durationMs = parseFloat(failMatch[2]);
      const idMatch = fullTitle.match(/\[(TC-[^\]]+)\]/);
      const testId = idMatch ? idMatch[1] : 'TC-GEN';
      const title = fullTitle.replace(/\[TC-[^\]]+\]\s*/, '');

      tests.push({
        id: testId,
        title,
        status: 'FAILED',
        durationMs
      });
    }
  }

  return tests;
}

async function main() {
  console.log('===============================================================');
  console.log('🚀 [MoveSafe VN] BẮT ĐẦU CHẠY TOÀN BỘ BỘ KIỂM THỬ THAM CHIẾU');
  console.log('===============================================================');

  const allResults = {
    suiteRunAt: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      browserEngine: 'Microsoft Edge Headless (Chromium)'
    },
    suites: [],
    summary: {
      totalSuites: testSuites.length,
      totalTests: 0,
      passed: 0,
      failed: 0,
      passRate: '0%',
      totalDurationMs: 0
    }
  };

  let totalDuration = 0;

  for (const suite of testSuites) {
    console.log(`\n⏳ Đang thực thi Suite: ${suite.category} (${suite.file})...`);
    const { code, stdout, stderr, durationMs } = await runCommand('node', ['--test', suite.file]);
    totalDuration += durationMs;

    const parsedTests = parseTestOutput(stdout);
    const suitePassed = parsedTests.filter(t => t.status === 'PASSED').length;
    const suiteFailed = parsedTests.filter(t => t.status === 'FAILED').length;

    console.log(`   ➔ Kết quả: ${suitePassed} Passed, ${suiteFailed} Failed (${durationMs}ms)`);

    allResults.suites.push({
      file: suite.file,
      category: suite.category,
      prefix: suite.prefix,
      exitCode: code,
      durationMs,
      tests: parsedTests
    });

    allResults.summary.totalTests += parsedTests.length;
    allResults.summary.passed += suitePassed;
    allResults.summary.failed += suiteFailed;
  }

  const passRateNum = allResults.summary.totalTests > 0
    ? ((allResults.summary.passed / allResults.summary.totalTests) * 100).toFixed(1)
    : 100;
  allResults.summary.passRate = `${passRateNum}%`;
  allResults.summary.totalDurationMs = totalDuration;

  console.log('\n===============================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ:`);
  console.log(`- Tổng số ca kiểm thử: ${allResults.summary.totalTests}`);
  console.log(`- Thành công (PASSED): ${allResults.summary.passed}`);
  console.log(`- Thất bại (FAILED):  ${allResults.summary.failed}`);
  console.log(`- Tỷ lệ đạt chuẩn:    ${allResults.summary.passRate}`);
  console.log(`- Tổng thời gian:     ${(totalDuration / 1000).toFixed(2)}s`);
  console.log('===============================================================');

  const outputPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2), 'utf8');
  console.log(`💾 Đã xuất file số liệu kiểm thử: ${outputPath}`);
}

main().catch(console.error);

