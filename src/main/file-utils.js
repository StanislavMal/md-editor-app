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

export async function getKatexCSS() {
  try {
    const cssPath = path.join(__dirname, '../../node_modules/katex/dist/katex.css');
    return await fs.readFile(cssPath, 'utf-8');
  } catch (error) {
    console.error("Не удалось загрузить KaTeX CSS:", error);
    return '';
  }
}

export async function buildFullHTML(htmlContent, githubCss, printCss, highlightCss, katexCss) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${githubCss}
        ${printCss}
        ${highlightCss}
        ${katexCss}
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
