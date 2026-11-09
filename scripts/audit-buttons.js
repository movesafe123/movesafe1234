const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('js/app.js', 'utf8');
const aiChatJs = fs.readFileSync('js/ai-chat.js', 'utf8');

const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
let match;
const audit = [];

while ((match = buttonRegex.exec(html)) !== null) {
  const attrs = match[1];
  const inner = match[2].replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/\s+/g, ' ').trim();
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);
  const onclickMatch = attrs.match(/onclick=["']([^"']+)["']/i);
  const typeMatch = attrs.match(/type=["']([^"']+)["']/i);

  const id = idMatch ? idMatch[1] : null;
  const className = classMatch ? classMatch[1] : null;
  const hasOnclick = !!onclickMatch;
  const isSubmit = typeMatch && typeMatch[1] === 'submit';

  let hasListenerInApp = false;
  let hasListenerInAi = false;

  if (id) {
    if (appJs.includes(`'${id}'`) || appJs.includes(`"${id}"`)) hasListenerInApp = true;
    if (aiChatJs.includes(`'${id}'`) || aiChatJs.includes(`"${id}"`)) hasListenerInAi = true;
  }

  // Check class listeners
  if (className) {
    const classes = className.split(/\s+/);
    for (const c of classes) {
      if (c && c.length > 3) {
        if (appJs.includes(`.${c}`)) hasListenerInApp = true;
        if (aiChatJs.includes(`.${c}`)) hasListenerInAi = true;
      }
    }
  }

  const isBound = hasOnclick || hasListenerInApp || hasListenerInAi || isSubmit;

  audit.push({
    id,
    className,
    text: inner,
    hasOnclick,
    hasListenerInApp,
    hasListenerInAi,
    isSubmit,
    isBound
  });
}

console.log('--- KẾT QUẢ RÀ SOÁT TẤT CẢ 98 NÚT BẤM ---');
const unbound = audit.filter(b => !b.isBound);
console.log('Tổng số nút:', audit.length);
console.log('Số nút ĐÃ ĐƯỢC GẮN XỬ LÝ (Bound):', audit.filter(b => b.isBound).length);
console.log('Số nút CHƯA ĐƯỢC GẮN XỬ LÝ (Unbound):', unbound.length);

if (unbound.length > 0) {
  console.log('\nDANH SÁCH NÚT CHƯA GẮN XỬ LÝ:');
  unbound.forEach((b, i) => {
    console.log(`[${i+1}] ID: "${b.id}", Class: "${b.className}", Text: "${b.text}"`);
  });
}

