const fs = require('fs');
const c = fs.readFileSync('logcat_fresh.txt', 'utf8');
const lines = c.split('\n');
const rnLines = lines.filter(l =>
  l.includes('ReactNative') || l.includes('iuhconnect') ||
  l.includes('FATAL') || l.includes('Exception') ||
  l.includes('React') || l.includes('crash') ||
  l.includes('Crash') || l.includes('SoLoader') ||
  l.includes('hermes') || l.includes('Hermes') ||
  l.includes('bundle') || l.includes('Bundle') ||
  l.includes('JSC') || l.includes('JavaScript') ||
  l.includes('Application') || l.includes('MainActivity')
);
console.log('Found', rnLines.length, 'relevant lines:');
rnLines.forEach(l => console.log(l.trim()));
