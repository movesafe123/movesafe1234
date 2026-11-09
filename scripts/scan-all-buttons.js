const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
let match;
const buttons = [];
while ((match = buttonRegex.exec(html)) !== null) {
  const attrs = match[1];
  const inner = match[2].replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/\s+/g, ' ').trim();
  const idMatch = attrs.match(/id=["']([^"']+)["']/i);
  const classMatch = attrs.match(/class=["']([^"']+)["']/i);
  const onclickMatch = attrs.match(/onclick=["']([^"']+)["']/i);
  const titleMatch = attrs.match(/title=["']([^"']+)["']/i);
  const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
  buttons.push({
    id: idMatch ? idMatch[1] : null,
    className: classMatch ? classMatch[1] : null,
    onclick: onclickMatch ? onclickMatch[1] : null,
    title: titleMatch ? titleMatch[1] : null,
    type: typeMatch ? typeMatch[1] : 'button',
    text: inner
  });
}

console.log('Tổng số nút <button> trong index.html:', buttons.length);
buttons.forEach((b, i) => {
  console.log(`[${i+1}] ID: "${b.id || '(no-id)'}", Class: "${b.className || ''}", Text: "${b.text}", Onclick: ${b.onclick ? 'YES' : 'NO'}`);
});

