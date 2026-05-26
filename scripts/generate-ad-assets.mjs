import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'apps', 'web', 'public', 'ads');
mkdirSync(outDir, { recursive: true });

const colors = {
  bg: '#080b1a',
  panel: '#12172a',
  panel2: '#171d33',
  text: '#f8fafc',
  muted: '#aab4cf',
  blue: '#4285f4',
  violet: '#a16ce3',
  rose: '#e36d7d',
  green: '#34d399',
};

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fontCss() {
  return `
    @font-face { font-family: InterFallback; src: local("Inter"), local("Segoe UI"); }
    * { box-sizing: border-box; }
    body { margin: 0; }
    .frame {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background:
        radial-gradient(circle at 22% 12%, rgba(66,133,244,.38), transparent 31%),
        radial-gradient(circle at 86% 16%, rgba(161,108,227,.34), transparent 34%),
        radial-gradient(circle at 60% 94%, rgba(227,109,125,.28), transparent 32%),
        ${colors.bg};
      color: ${colors.text};
      font-family: InterFallback, "Segoe UI", Arial, sans-serif;
      letter-spacing: 0;
    }
    .grid {
      position: absolute;
      inset: 0;
      opacity: .24;
      background-image:
        linear-gradient(rgba(255,255,255,.09) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.09) 1px, transparent 1px);
      background-size: 72px 72px;
      mask-image: radial-gradient(circle at 50% 28%, black, transparent 76%);
    }
    .brand { display: flex; align-items: center; gap: 16px; font-weight: 800; }
    .mark {
      width: 64px; height: 64px; border-radius: 20px;
      display: grid; place-items: center;
      border: 1px solid rgba(255,255,255,.22);
      background: linear-gradient(135deg, rgba(66,133,244,.95), rgba(161,108,227,.72), rgba(227,109,125,.68));
      box-shadow: 0 26px 70px rgba(66,133,244,.28);
      font-size: 22px;
    }
    .eyebrow {
      display: inline-flex; width: fit-content;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(255,255,255,.075);
      border-radius: 999px;
      padding: 12px 18px;
      color: rgba(255,255,255,.82);
      font-size: 20px;
      font-weight: 700;
    }
    .title {
      margin: 0;
      line-height: .98;
      font-weight: 900;
      letter-spacing: 0;
      background: linear-gradient(94deg, ${colors.blue}, ${colors.violet} 54%, ${colors.rose});
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .subtitle {
      margin: 0;
      color: #d7dded;
      line-height: 1.55;
      font-weight: 500;
    }
    .cta {
      width: fit-content;
      border-radius: 999px;
      padding: 18px 28px;
      background: ${colors.blue};
      color: white;
      font-weight: 900;
      box-shadow: 0 22px 56px rgba(66,133,244,.35);
    }
    .glass {
      border: 1px solid rgba(255,255,255,.13);
      background: linear-gradient(180deg, rgba(255,255,255,.105), rgba(255,255,255,.035)), rgba(18,23,42,.72);
      box-shadow: 0 30px 90px rgba(0,0,0,.36);
      backdrop-filter: blur(16px);
    }
    .dashboard { border-radius: 34px; padding: 28px; }
    .provider-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .pill {
      border-radius: 999px;
      padding: 10px 14px;
      color: #dce5ff;
      background: rgba(255,255,255,.075);
      border: 1px solid rgba(255,255,255,.11);
      font-weight: 700;
    }
    .score {
      width: 210px; height: 210px; border-radius: 50%;
      display: grid; place-items: center;
      margin: 30px auto 24px;
      background:
        radial-gradient(circle at 30% 22%, rgba(255,255,255,.82), transparent 9%),
        radial-gradient(circle at 34% 31%, rgba(66,133,244,.95), transparent 36%),
        radial-gradient(circle at 68% 34%, rgba(161,108,227,.82), transparent 38%),
        radial-gradient(circle at 54% 80%, rgba(227,109,125,.72), transparent 36%),
        #141a30;
      box-shadow: inset 0 1px 28px rgba(255,255,255,.2), 0 30px 80px rgba(66,133,244,.26);
    }
    .score strong { display: block; font-size: 64px; line-height: .9; }
    .score span { color: rgba(255,255,255,.74); font-size: 16px; font-weight: 800; }
    .metric { border-radius: 24px; padding: 18px; background: rgba(255,255,255,.065); }
    .metric b { display:block; font-size: 34px; margin-top: 6px; }
    .metric span { color: ${colors.muted}; font-size: 15px; font-weight: 700; }
    .scan { height: 11px; border-radius: 999px; background: rgba(255,255,255,.09); overflow: hidden; }
    .scan:before {
      content: ""; display: block; width: 54%; height: 100%; border-radius: inherit;
      background: linear-gradient(90deg, transparent, ${colors.blue}, ${colors.violet}, transparent);
      transform: translateX(78%);
    }
    .rtl { direction: rtl; text-align: right; font-family: "Segoe UI", Tahoma, Arial, sans-serif; }
    .ltr { direction: ltr; text-align: left; }
  `;
}

function shell({ width, height, inner }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" class="frame" style="width:${width}px;height:${height}px">
      <style>${fontCss()}</style>
      <div class="grid"></div>
      ${inner}
    </div>
  </foreignObject>
</svg>`;
}

function brand(size = 64) {
  return `<div class="brand">
    <div class="mark" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .34)}px;border-radius:${Math.round(size * .31)}px">GS</div>
    <div>
      <div style="font-size:${Math.round(size * .36)}px;line-height:1">GeoSight</div>
      <div style="margin-top:6px;color:${colors.muted};font-size:${Math.round(size * .18)}px;font-weight:700">Your brand visibility in the AI era</div>
    </div>
  </div>`;
}

function dashboard(scale = 1) {
  return `<div class="dashboard glass" style="transform:scale(${scale});transform-origin:center">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:20px">
      <div>
        <div style="font-size:24px;font-weight:900">Visibility simulation</div>
        <div style="margin-top:8px;color:${colors.muted};font-size:16px;font-weight:700">Arabic-native GEO scan</div>
      </div>
      <div class="pill" style="color:#bfffe5;background:rgba(52,211,153,.12);border-color:rgba(52,211,153,.26)">Live scan</div>
    </div>
    <div class="score"><div style="text-align:center"><span>GEO Score</span><strong>78</strong></div></div>
    <div class="provider-row" style="justify-content:center;margin-bottom:20px">
      <div class="pill">ChatGPT</div><div class="pill">Gemini</div><div class="pill">Perplexity</div>
    </div>
    <div style="display:grid;gap:14px">
      ${['Prompt interpretation', 'Dialect normalization', 'Brand detection'].map((label, i) => `
        <div class="metric">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:18px">
            <span>${esc(label)}</span><b style="font-size:18px;margin:0;color:#e8ecfb">0${i + 1}</b>
          </div>
          <div class="scan" style="margin-top:13px"></div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

const assets = [
  {
    file: 'geosight-hero-ad.svg',
    width: 1600,
    height: 900,
    inner: `
      <div style="position:absolute;inset:70px;display:grid;grid-template-columns:1.05fr .95fr;gap:72px;align-items:center">
        <div class="rtl" style="display:flex;flex-direction:column;gap:32px">
          ${brand(70)}
          <div class="eyebrow">أول منصة GEO عربية</div>
          <h1 class="title" style="font-size:96px">اعرف كيف تظهر علامتك في إجابات الذكاء الاصطناعي</h1>
          <p class="subtitle" style="font-size:31px;max-width:760px">تتبّع حضورك في ChatGPT وGemini وPerplexity بدقة تفهم اللهجات العربية.</p>
          <div class="cta" style="font-size:26px">انضم لقائمة الانتظار</div>
        </div>
        ${dashboard(.98)}
      </div>`,
  },
  {
    file: 'geosight-social-square.svg',
    width: 1080,
    height: 1080,
    inner: `
      <div style="position:absolute;inset:64px;display:flex;flex-direction:column;justify-content:space-between">
        ${brand(68)}
        <div class="rtl" style="display:flex;flex-direction:column;gap:26px">
          <div class="eyebrow" style="font-size:19px">GEO للعالم العربي</div>
          <h1 class="title" style="font-size:86px">هل تظهر علامتك عندما يسأل العملاء الذكاء الاصطناعي؟</h1>
          <p class="subtitle" style="font-size:29px">GeoSight يقيس الظهور، المنافسين، والكلمات التي تصنع القرار.</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
          <div class="metric"><span>GEO Score</span><b>78</b></div>
          <div class="metric"><span>Mentions</span><b>126</b></div>
          <div class="metric"><span>Dialects</span><b>4</b></div>
        </div>
      </div>`,
  },
  {
    file: 'geosight-story-ad.svg',
    width: 1080,
    height: 1920,
    inner: `
      <div style="position:absolute;inset:72px 64px;display:flex;flex-direction:column;gap:56px">
        ${brand(76)}
        <div class="rtl" style="display:flex;flex-direction:column;gap:30px">
          <div class="eyebrow">للـ Agencies والعلامات العربية</div>
          <h1 class="title" style="font-size:96px">حوّل أسئلة العملاء إلى بيانات ظهور قابلة للقياس</h1>
          <p class="subtitle" style="font-size:34px">راقب كيف يذكر الذكاء الاصطناعي علامتك ومنافسيك عبر لهجات عربية متعددة.</p>
        </div>
        <div style="margin:auto 0">${dashboard(1.06)}</div>
        <div class="cta rtl" style="font-size:30px;align-self:flex-start">احجز مقعدك في البيتا</div>
      </div>`,
  },
  {
    file: 'geosight-og-ad.svg',
    width: 1200,
    height: 628,
    inner: `
      <div style="position:absolute;inset:52px;display:grid;grid-template-columns:1.12fr .88fr;gap:50px;align-items:center">
        <div class="rtl" style="display:flex;flex-direction:column;gap:22px">
          ${brand(56)}
          <div class="eyebrow" style="font-size:16px;padding:10px 15px">Arabic-native AI visibility</div>
          <h1 class="title" style="font-size:66px">قس ظهور علامتك في محركات الذكاء الاصطناعي</h1>
          <p class="subtitle" style="font-size:24px">ChatGPT • Gemini • Perplexity</p>
        </div>
        ${dashboard(.74)}
      </div>`,
  },
];

for (const asset of assets) {
  writeFileSync(join(outDir, asset.file), shell(asset), 'utf8');
}

const preview = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GeoSight Ad Assets</title>
  <style>
    body { margin: 0; background: #050713; color: #f8fafc; font-family: "Segoe UI", Arial, sans-serif; }
    main { width: min(1180px, calc(100% - 40px)); margin: 40px auto; display: grid; gap: 28px; }
    h1 { margin: 0 0 8px; }
    p { color: #aab4cf; margin: 0 0 20px; }
    figure { margin: 0; display: grid; gap: 10px; }
    img { width: 100%; height: auto; border: 1px solid rgba(255,255,255,.12); border-radius: 8px; background: #080b1a; }
    figcaption { color: #cbd5e1; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <div>
      <h1>صور GeoSight الإعلانية</h1>
      <p>نسخ SVG جاهزة، ومعها PNG بعد التصدير.</p>
    </div>
    ${assets.map((asset) => `<figure><img src="./${asset.file}" alt="${asset.file}" /><figcaption>${asset.file} - ${asset.width}x${asset.height}</figcaption></figure>`).join('\n')}
  </main>
</body>
</html>`;

writeFileSync(join(outDir, 'preview.html'), preview, 'utf8');

console.log(`Generated ${assets.length} SVG ad assets in ${outDir}`);
