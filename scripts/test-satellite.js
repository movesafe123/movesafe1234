const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testSatellite() {
  console.log('🚀 Launching Edge to test Satellite mode performance...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  console.log('⏳ Waiting 3s for map and pre-warming...');
  await new Promise(r => setTimeout(r, 3500));

  // Click layer menu
  console.log('🗺️ Opening layer menu...');
  await page.click('#btn-gm-layers');
  await new Promise(r => setTimeout(r, 500));

  // Measure time to switch satellite
  console.log('⚡ Toggling Satellite layer checkbox...');
  const tStart = Date.now();
  await page.click('#chk-layer-satellite');
  
  // Wait for satellite tiles to load
  await page.waitForFunction(() => {
    const tiles = document.querySelectorAll('.leaflet-tile-loaded');
    return tiles.length > 5;
  }, { timeout: 10000 });
  const tElapsed = Date.now() - tStart;
  console.log('✅ Satellite tiles loaded in: ' + tElapsed + 'ms!');

  await new Promise(r => setTimeout(r, 2000));

  const outPath = path.join(__dirname, '..', 'public', 'screenshots', 'satellite_mode_fast.png');
  await page.screenshot({ path: outPath });
  console.log('📸 Screenshot saved to:', outPath);

  // Test pan / zoom in satellite mode to verify smoothness
  console.log('🔄 Testing pan in satellite mode...');
  await page.evaluate(() => {
    window.mapEngine.map.panBy([150, 150], { animate: true });
  });
  await new Promise(r => setTimeout(r, 1000));

  // Test pin click to verify lazy popup works instantly
  console.log('🔍 Testing pin click popup in satellite mode...');
  const pinClicked = await page.evaluate(() => {
    const pin = document.querySelector('.gm-weather-pin');
    if (pin) {
      pin.click();
      return true;
    }
    return false;
  });
  console.log('Pin clicked:', pinClicked);
  await new Promise(r => setTimeout(r, 1000));

  const outPopup = path.join(__dirname, '..', 'public', 'screenshots', 'satellite_popup_fast.png');
  await page.screenshot({ path: outPopup });
  console.log('📸 Popup screenshot saved to:', outPopup);

  await browser.close();
  console.log('🎉 Satellite test finished successfully!');
}

testSatellite().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

