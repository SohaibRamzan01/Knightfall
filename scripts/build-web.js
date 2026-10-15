// Copies the static game into www/, the folder Capacitor packages into the Android app.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const entry of ['index.html', 'css', 'js']) {
  fs.cpSync(path.join(root, entry), path.join(out, entry), { recursive: true });
}
console.log('Web assets copied to www/');
