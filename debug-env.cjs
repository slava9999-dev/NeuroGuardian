const fs = require('fs');
const content = fs.readFileSync('.env', 'utf8');
const match = content.match(/OPENAI_API_KEY="([^"]+)"/);
if (match) {
  process.stdout.write(match[1]);
} else {
  process.stdout.write('NO_MATCH');
}
