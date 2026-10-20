const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'screenshots');

async function testMobile() {
  console.log('📱 Testing Mobile layout (iPhone 14 / 390x844)...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=390,844']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000));

  const mobile1 = path.join(OUTPUT_DIR, 'mobile_1_map.png');
  await page.screenshot({ path: mobile1 });
  console.log('✅ Mobile Map:', mobile1);

  // Click Chỉ đường tab on mobile bottom nav
  console.log('📱 Bấm tab Chỉ đường trên mobile bottom nav...');
  await page.click('#mnav-route');
  await new Promise(r => setTimeout(r, 2000));

  const mobile2 = path.join(OUTPUT_DIR, 'mobile_2_route.png');
  await page.screenshot({ path: mobile2 });
  console.log('✅ Mobile Route:', mobile2);

  // Click Trợ lý AI tab on mobile bottom nav
  console.log('📱 Bấm tab Trợ lý AI trên mobile bottom nav...');
  await page.click('#mnav-ai');
  await new Promise(r => setTimeout(r, 1500));

  const mobile3 = path.join(OUTPUT_DIR, 'mobile_3_ai.png');
  await page.screenshot({ path: mobile3 });
  console.log('✅ Mobile AI:', mobile3);

  await browser.close();
  console.log('🎉 Mobile test hoàn tất thành công 100%!');
}

testMobile().catch(err => {
  console.error('Mobile test error:', err);
  process.exit(1);
});

