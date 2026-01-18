// src/main/file-utils.js
// --- ИМПОРТЫ ---
import fs from 'fs/promises';
import path from 'path';
import isDev from 'electron-is-dev';
import { app } from 'electron'; 

export async function convertImagesToBase64(html, net) {
  const imgRegex = /<img([^>]*?)src=["'](safe-file:\/\/|https?:\/\/)([^"']+)["']([^>]*?)>/gi;
  let result = html;
  const matches = [...html.matchAll(imgRegex)];
  for (const match of matches) {
    const fullTag = match[0];
    const beforeSrc = match[1];
    const protocol = match[2];
    const urlOrPath = match[3];
    const afterSrc = match[4];
    try {
      let imageBuffer;
      let mimeType = 'image/png';
      if (protocol === 'safe-file://') {
        const filePath = urlOrPath;
        imageBuffer = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        if (ext === '.gif') mimeType = 'image/gif';
        if (ext === '.webp') mimeType = 'image/webp';
        if (ext === '.svg') mimeType = 'image/svg+xml';
      } else {
        const fullUrl = protocol + urlOrPath;
        const response = await net.fetch(fullUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.startsWith('image/')) mimeType = contentType;
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;
      const newTag = `<img${beforeSrc}src="${dataUrl}"${afterSrc}>`;
      result = result.replace(fullTag, newTag);
      console.log(`✓ Изображение обработано: ${path.basename(urlOrPath)}`);
    } catch (error) {
      console.error(`✗ Не удалось загрузить/обработать изображение ${protocol}${urlOrPath}:`, error.message);
    }
  }
  return result;
}

export async function getGitHubCSS() {
  try {
    // __dirname указывает на src/main, поэтому нужно подняться на 2 уровня
    const cssPath = path.join(__dirname, '../../node_modules/github-markdown-css/github-markdown.css');
    return await fs.readFile(cssPath, 'utf-8');
  } catch (error) {
    console.error("Не удалось загрузить github-markdown.css:", error);
    return '';
  }
}

export async function getPrintCSS() {
  try {
    let cssPath;
    if (isDev) {
      // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
      // В режиме разработки обращаемся к ИСХОДНОМУ файлу в src/renderer/public
      cssPath = path.join(app.getAppPath(), 'src/renderer/public/print.css'); 
    } else {
      // В продакшене файл будет лежать в корне папки renderer,
      // относительно собранного main-процесса.
      // Это path.join(__dirname, '../renderer/print.css')
      cssPath = path.join(app.getAppPath(), 'out/renderer/print.css'); // Или просто '../renderer/print.css' если out/main является __dirname
    }
    console.log(`[Main] Пытаюсь загрузить print.css из: ${cssPath}`);
    return await fs.readFile(cssPath, 'utf-8');
  } catch (error) {
    console.error("Не удалось загрузить print.css:", error);
    return '';
  }
}

export async function getHighlightCSS() {
  try {
    const cssPath = path.join(__dirname, '../../node_modules/highlight.js/styles/github.css');
    return await fs.readFile(cssPath, 'utf-8');
  } catch (error) {
    console.error("Не удалось загрузить highlight.js CSS:", error);
    return '';
  }
}

export async function getMathJaxChtmlCSS() {
  // MathJax CHTML CSS с @font-face для шрифтов
  return `
    /* MathJax CHTML styles */
    mjx-container {
      display: inline-block;
      text-align: left;
    }
    mjx-container > svg {
      display: block;
    }
    mjx-container[jax="CHTML"] {
      line-height: 0;
    }
    mjx-container[jax="CHTML"] > mjx-math {
      display: inline-block;
      text-align: left;
      line-height: 0;
    }
    mjx-container[jax="CHTML"] > mjx-math > * {
      display: inline-block;
      line-height: 1.1;
    }
    mjx-container[jax="CHTML"] mjx-mi {
      font-family: MJXc-TeX-main-R, MJXc-TeX-main-Rw;
    }
    mjx-container[jax="CHTML"] mjx-mn {
      font-family: MJXc-TeX-main-R, MJXc-TeX-main-Rw;
    }
    mjx-container[jax="CHTML"] mjx-mo {
      font-family: MJXc-TeX-main-R, MJXc-TeX-main-Rw;
    }
    mjx-container[jax="CHTML"] mjx-ms {
      font-family: MJXc-TeX-main-R, MJXc-TeX-main-Rw;
    }
    mjx-container[jax="CHTML"] mjx-mtext {
      font-family: MJXc-TeX-main-R, MJXc-TeX-main-Rw;
    }
    mjx-container[jax="CHTML"] mjx-c > mjx-mtext {
      font-family: MJXc-TeX-main-R, MJXc-TeX-main-Rw;
    }
    mjx-container[jax="CHTML"] mjx-mi mjx-numerator,
    mjx-container[jax="CHTML"] mjx-mi mjx-denominator,
    mjx-container[jax="CHTML"] mjx-mn mjx-numerator,
    mjx-container[jax="CHTML"] mjx-mn mjx-denominator,
    mjx-container[jax="CHTML"] mjx-mo mjx-numerator,
    mjx-container[jax="CHTML"] mjx-mo mjx-denominator,
    mjx-container[jax="CHTML"] mjx-ms mjx-numerator,
    mjx-container[jax="CHTML"] mjx-ms mjx-denominator,
    mjx-container[jax="CHTML"] mjx-mtext mjx-numerator,
    mjx-container[jax="CHTML"] mjx-mtext mjx-denominator {
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-mi mjx-sup,
    mjx-container[jax="CHTML"] mjx-mn mjx-sup,
    mjx-container[jax="CHTML"] mjx-mo mjx-sup,
    mjx-container[jax="CHTML"] mjx-ms mjx-sup,
    mjx-container[jax="CHTML"] mjx-mtext mjx-sup {
      vertical-align: 0.5em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-mi mjx-sub,
    mjx-container[jax="CHTML"] mjx-mn mjx-sub,
    mjx-container[jax="CHTML"] mjx-mo mjx-sub,
    mjx-container[jax="CHTML"] mjx-ms mjx-sub,
    mjx-container[jax="CHTML"] mjx-mtext mjx-sub {
      vertical-align: -0.2em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-mi mjx-under,
    mjx-container[jax="CHTML"] mjx-mn mjx-under,
    mjx-container[jax="CHTML"] mjx-mo mjx-under,
    mjx-container[jax="CHTML"] mjx-ms mjx-under,
    mjx-container[jax="CHTML"] mjx-mtext mjx-under {
      border-bottom: 1px solid;
      padding-bottom: 2px;
    }
    mjx-container[jax="CHTML"] mjx-mi mjx-over,
    mjx-container[jax="CHTML"] mjx-mn mjx-over,
    mjx-container[jax="CHTML"] mjx-mo mjx-over,
    mjx-container[jax="CHTML"] mjx-ms mjx-over,
    mjx-container[jax="CHTML"] mjx-mtext mjx-over {
      border-top: 1px solid;
      padding-top: 2px;
      margin-bottom: -2px;
    }
    mjx-container[jax="CHTML"] mjx-mfrac mjx-num {
      display: inline-block;
      vertical-align: 0.1em;
      padding: 0.12em;
      border-bottom: 1px solid;
      text-align: center;
    }
    mjx-container[jax="CHTML"] mjx-mfrac mjx-den {
      display: inline-block;
      vertical-align: -0.3em;
      padding: 0.12em;
      text-align: center;
    }
    mjx-container[jax="CHTML"] mjx-mfrac mjx-frac {
      display: inline-block;
      vertical-align: 0.04em;
      padding: 0.12em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-msqrt mjx-sqrt {
      display: inline-block;
      padding-top: 0.1em;
      padding-right: 0.22em;
      padding-left: 0.36em;
      margin-top: 0.1em;
      border-top: 1px solid;
    }
    mjx-container[jax="CHTML"] mjx-msqrt mjx-root {
      display: inline-block;
      margin-top: 0.1em;
      margin-left: -0.36em;
      padding-left: 0.36em;
      padding-right: 0.22em;
      border-top: 1px solid;
      font-size: 70.7%;
      vertical-align: top;
    }
    mjx-container[jax="CHTML"] mjx-mroot mjx-root {
      margin-left: -0.36em;
      padding-left: 0.36em;
      padding-right: 0.22em;
      border-top: 1px solid;
      font-size: 70.7%;
      vertical-align: top;
    }
    mjx-container[jax="CHTML"] mjx-mroot mjx-rad {
      display: inline-block;
      vertical-align: -0.3em;
      padding: 0.12em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-msub mjx-base {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-msub mjx-sub {
      display: inline-block;
      vertical-align: -0.2em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-msup mjx-base {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-msup mjx-sup {
      display: inline-block;
      vertical-align: 0.5em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-msubsup mjx-base {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-msubsup mjx-sub {
      display: inline-block;
      vertical-align: -0.2em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-msubsup mjx-sup {
      display: inline-block;
      vertical-align: 0.5em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-munder mjx-base {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-munder mjx-under {
      display: inline-block;
      border-bottom: 1px solid;
      padding-bottom: 2px;
    }
    mjx-container[jax="CHTML"] mjx-mover mjx-base {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-mover mjx-over {
      display: inline-block;
      border-top: 1px solid;
      padding-top: 2px;
      margin-bottom: -2px;
    }
    mjx-container[jax="CHTML"] mjx-munderover mjx-base {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-munderover mjx-under {
      display: inline-block;
      border-bottom: 1px solid;
      padding-bottom: 2px;
    }
    mjx-container[jax="CHTML"] mjx-munderover mjx-over {
      display: inline-block;
      border-top: 1px solid;
      padding-top: 2px;
      margin-bottom: -2px;
    }
    mjx-container[jax="CHTML"] mjx-mmunder mjx-base {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-mmunder mjx-under {
      display: inline-block;
      border-bottom: 1px solid;
      padding-bottom: 2px;
    }
    mjx-container[jax="CHTML"] mjx-mmultiscripts mjx-base {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-mmultiscripts mjx-pre {
      display: inline-block;
      vertical-align: -0.2em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-mmultiscripts mjx-post {
      display: inline-block;
      vertical-align: 0.5em;
      font-size: 70.7%;
    }
    mjx-container[jax="CHTML"] mjx-mtable {
      display: inline-block;
      vertical-align: 0.2em;
    }
    mjx-container[jax="CHTML"] mjx-mtable > mjx-table {
      display: inline-block;
      vertical-align: -0.2em;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-table {
      display: inline-table;
      border-collapse: collapse;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-table > mjx-itable > mjx-row {
      display: table-row;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-table > mjx-itable > mjx-row > mjx-cell {
      display: table-cell;
      text-align: center;
      padding: 0.2em 0.4em;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-table > mjx-itable > mjx-row > mjx-cell[mjx-overlap="1"] {
      padding-left: 0;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-table > mjx-itable > mjx-row > mjx-cell[mjx-overlap="2"] {
      padding-left: 0;
      padding-right: 0;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-table > mjx-itable > mjx-row > mjx-cell[mjx-overlap="3"] {
      padding-left: 0;
      padding-right: 0;
      padding-top: 0;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-linestyle {
      background-color: #000;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-linestyle > mjx-linestyle {
      background-color: #FFF;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-linestyle > mjx-linestyle > mjx-linestyle {
      background-color: #000;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-rowsep {
      display: table-row;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-rowsep > mjx-rowsep {
      display: table-cell;
      width: 0;
      border-bottom: 1px solid;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-rowsep > mjx-rowsep > mjx-rowsep {
      border-bottom: none;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-rowsep > mjx-rowsep > mjx-rowsep > mjx-rowsep {
      border-bottom: 1px solid;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-colsep {
      display: table-row;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-colsep > mjx-colsep {
      display: table-cell;
      width: 0;
      border-right: 1px solid;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-colsep > mjx-colsep > mjx-colsep {
      border-right: none;
    }
    mjx-container[jax="CHTML"] mjx-mtable mjx-colsep > mjx-colsep > mjx-colsep > mjx-colsep {
      border-right: 1px solid;
    }
    mjx-container[jax="CHTML"] mjx-maction {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-maction > mjx-tool {
      display: none;
    }
    mjx-container[jax="CHTML"] mjx-maction[mjx-hit="1"] > mjx-tool {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-maction[mjx-hit="1"] > mjx-base {
      display: none;
    }
    mjx-container[jax="CHTML"] mjx-merror {
      display: inline-block;
      color: red;
      background-color: #FFB0B0;
      border: 1px solid red;
      padding: 0.1em;
    }
    mjx-container[jax="CHTML"] mjx-mphantom {
      visibility: hidden;
    }
    mjx-container[jax="CHTML"] mjx-mspace {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-c {
      display: inline-block;
    }
    mjx-container[jax="CHTML"] mjx-utext {
      font-family: MJXc-TeX-main-R, MJXc-TeX-main-Rw;
    }
    @font-face {
      font-family: MJXc-TeX-main-R;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Main-Regular.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-main-Rw;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Main-Regular.woff") format("woff");
      font-weight: bold;
    }
    @font-face {
      font-family: MJXc-TeX-main-B;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Main-Bold.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-main-Bx;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Main-Bold.woff") format("woff");
      font-weight: bold;
    }
    @font-face {
      font-family: MJXc-TeX-main-I;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Main-Italic.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-main-M;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Main-Regular.woff") format("woff");
      font-style: italic;
    }
    @font-face {
      font-family: MJXc-TeX-math-I;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Math-Italic.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-size1-R;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Size1-Regular.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-size2-R;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Size2-Regular.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-size3-R;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Size3-Regular.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-size4-R;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Size4-Regular.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-vec-R;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Vector-Regular.woff") format("woff");
    }
    @font-face {
      font-family: MJXc-TeX-vec-B;
      src: url("https://cdn.jsdelivr.net/npm/mathjax@3/es5/output/chtml/fonts/woff-v2/MathJax_Vector-Bold.woff") format("woff");
    }
  `;
}

export async function buildFullHTML(htmlContent, githubCss, printCss, highlightCss, mathJaxCss) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${githubCss}
        ${printCss}
        ${highlightCss}
        ${mathJaxCss}
      </style>
    </head>
    <body>
      <article class="markdown-body">
        ${htmlContent}
      </article>
    </body>
    </html>
  `;
}
