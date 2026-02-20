/**
 * Fetch WakaTime last-7-days stats and update README between markers.
 * Requires a secret named WAKATIME_API_KEY in your repo settings.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const README_PATH = path.resolve(process.cwd(), 'README.md');
const START = '<!--WAKATIME:START-->';
const END = '<!--WAKATIME:END-->';
const LAST_UPDATED_START = '<!--LAST_UPDATED-->';
const LAST_UPDATED_END = '<!--/LAST_UPDATED-->';

const apiKey = process.env.WAKATIME_API_KEY;
const fallback = [
  { name: 'TypeScript', text: '18 hrs 30 mins', percent: 90.28 },
  { name: 'Markdown', text: '25 mins', percent: 2.06 },
  { name: 'YAML', text: '22 mins', percent: 1.80 },
  { name: 'SCSS', text: '20 mins', percent: 1.66 },
  { name: 'Other', text: '18 mins', percent: 1.53 },
];

function bar(p) {
  const total = 28; // width of the bar
  const filled = Math.round((p / 100) * total);
  const blocks = '░▒▓█';
  const full = '█';
  return full.repeat(filled) + '░'.repeat(total - filled);
}

function formatRows(items) {
  // Align columns similar to WakaTime
  const nameW = Math.max(...items.map(i => i.name.length), 10) + 2;
  const timeW = Math.max(...items.map(i => i.text.length), 9) + 2;
  return items
    .map(i => `${i.name.padEnd(nameW)}${i.text.padEnd(timeW)} ${bar(i.percent)}  ${i.percent.toFixed(2)} %`)
    .join('\n');
}

async function fetchWaka() {
  if (!apiKey) return null;
  const headers = {
    Authorization: 'Basic ' + Buffer.from(apiKey).toString('base64'),
    'Content-Type': 'application/json',
  };
  const url = 'https://wakatime.com/api/v1/users/current/stats/last_7_days?is_including_today=true';
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`WakaTime HTTP ${res.status}`);
  const json = await res.json();
  const languages = (json?.data?.languages || []).slice(0, 5);
  if (!languages.length) return null;
  return languages.map(l => ({
    name: l.name,
    text: l.text, // e.g., '18 hrs 30 mins'
    percent: Number(l.percent || 0),
  }));
}

async function run() {
  const readme = await fs.readFile(README_PATH, 'utf8');

  const stats = (await fetchWaka().catch(() => null)) || fallback;
  const block = '\n' + '```text' + `\n${formatRows(stats)}\n` + '```' + '\n';

  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);
  if (startIdx === -1 || endIdx === -1) throw new Error('Markers not found in README');

  const before = readme.slice(0, startIdx + START.length);
  const after = readme.slice(endIdx);
  const updatedOnce = before + '\n' + block + after;

  // Update last updated timestamp
  const ts = new Date().toISOString().split('T').join(' ').replace('Z', ' UTC');
  const withTs = updatedOnce.replace(
    new RegExp(`${LAST_UPDATED_START}[\\s\\S]*?${LAST_UPDATED_END}`),
    `${LAST_UPDATED_START}${ts}${LAST_UPDATED_END}`
  );

  await fs.writeFile(README_PATH, withTs);
  console.log('README updated');
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
