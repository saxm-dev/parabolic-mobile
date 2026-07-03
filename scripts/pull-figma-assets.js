// One-off: pull Home-screen icon assets from the Figma MCP asset CDN.
// SVGs → raw strings in src/assets/figma-icons.ts (rendered via SvgXml).
// Rasters → PNG files under assets/figma/.
const fs = require('fs');
const path = require('path');

const BASE = 'https://www.figma.com/api/mcp/asset/';
const ASSETS = {
  logoWordmark: 'de75927c-70a0-4ba3-9b63-2f74371301b1',
  navHome: '8eacd3f6-adb5-4859-922e-af79a58be87e',
  navTrades: '1a375b9e-7bc2-4586-935c-d99591da43f7',
  navLeaders: '59b2763d-0deb-48a2-ab6a-5012bd0a1e67',
  navProfile: 'aa9af90a-14b8-4a1a-9cb3-93d98280965e',
  navSearch: '574df674-bb80-4bcf-b0be-27f59e92c175',
  chipFootball: 'ec81eecf-2c19-467b-9a9e-d76197653fac',
  chipSoccer: '7e33ec68-3e8b-46db-a761-ac2183a2182c',
  chipBasketball: 'cdab83fa-115b-471e-bfd3-9d8798df389d',
  chipMma: '411aea74-2b55-4b2c-9c24-207b7a5ee880',
  coin: '841552cd-6a54-42da-aaf9-ecca79c215ee',
  plus: 'ef840818-fc50-4497-98c9-9532a32db228',
};

const outDir = path.join(__dirname, '..', 'assets', 'figma');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const svgs = {};
  for (const [name, id] of Object.entries(ASSETS)) {
    const res = await fetch(BASE + id);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('svg')) {
      const text = await res.text();
      svgs[name] = text;
      fs.writeFileSync(path.join(outDir, `${name}.svg`), text);
      console.log(`${name}: svg (${text.length}b)`);
    } else {
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = ct.includes('png') ? 'png' : ct.includes('jpeg') ? 'jpg' : 'bin';
      fs.writeFileSync(path.join(outDir, `${name}.${ext}`), buf);
      console.log(`${name}: ${ext} (${(buf.length / 1024).toFixed(1)}kb)`);
    }
  }
  // Emit the SVG strings as a typed module for SvgXml rendering.
  const lines = ['// Auto-generated from Figma (scripts/pull-figma-assets.js). Do not edit by hand.', ''];
  for (const [name, xml] of Object.entries(svgs)) {
    lines.push(`export const ${name} = ${JSON.stringify(xml)};`);
  }
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'figma-icons.ts'), lines.join('\n') + '\n');
  console.log(`\nWrote ${Object.keys(svgs).length} svg strings to src/assets/figma-icons.ts`);
})();
