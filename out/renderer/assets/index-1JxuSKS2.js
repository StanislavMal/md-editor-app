console.log("[Module Loaded] editor.js");
let codeMirrorInstance;
function initializeEditor() {
  const textarea = document.getElementById("markdown-input");
  codeMirrorInstance = CodeMirror.fromTextArea(textarea, {
    mode: "markdown",
    lineNumbers: true,
    lineWrapping: true,
    theme: "default",
    autofocus: true,
    viewportMargin: Infinity,
    extraKeys: {
      "Ctrl-B": () => applyMarkdown("bold"),
      "Ctrl-I": () => applyMarkdown("italic"),
      "Ctrl-H": () => applyMarkdown("heading"),
      "Ctrl-Q": () => applyMarkdown("quote"),
      "Ctrl-U": () => applyMarkdown("ul"),
      "Ctrl-O": () => applyMarkdown("ol"),
      "Ctrl-K": () => applyMarkdown("link"),
      "Ctrl-G": () => applyMarkdown("image"),
      "Ctrl-T": () => applyMarkdown("table"),
      // Горячие клавиши для вида и темы делегированы в state.js через toolbar.js
      "Tab": "indentMore",
      "Shift-Tab": "indentLess",
      "Shift-Enter": (cm) => insertLineBreak(cm)
    }
  });
  const editorWrapper = codeMirrorInstance.getWrapperElement();
  editorWrapper.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    window.electronAPI.showContextMenu();
  });
  editorWrapper.addEventListener("paste", handlePaste);
  editorWrapper.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    editorWrapper.style.backgroundColor = "rgba(0,120,255,0.1)";
  });
  editorWrapper.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    editorWrapper.style.backgroundColor = "transparent";
  });
  editorWrapper.addEventListener("drop", handleDrop);
  return codeMirrorInstance;
}
function insertLineBreak(cm) {
  const cursor = cm.getCursor();
  const currentLine = cm.getLine(cursor.line);
  if (currentLine.trim() === "") {
    cm.replaceSelection("\n&nbsp;\n");
  } else {
    cm.replaceSelection("\n");
  }
}
function applyMarkdown(type) {
  if (!codeMirrorInstance) return;
  const selection = codeMirrorInstance.getSelection();
  const cursor = codeMirrorInstance.getCursor();
  let newText = "";
  if (selection.includes("\n")) {
    const lines = selection.split("\n");
    let processedLines = [];
    let counter = 1;
    switch (type) {
      case "quote":
        processedLines = lines.map((line) => `> ${line}`);
        break;
      case "ul":
        processedLines = lines.map((line) => `- ${line}`);
        break;
      case "ol":
        processedLines = lines.map((line) => `${counter++}. ${line}`);
        break;
      default:
        codeMirrorInstance.replaceSelection(getFormattedText(type, selection));
        codeMirrorInstance.focus();
        return;
    }
    newText = processedLines.join("\n");
    codeMirrorInstance.replaceSelection(newText);
    codeMirrorInstance.focus();
    return;
  }
  if (type === "heading") {
    const lineText = codeMirrorInstance.getLine(cursor.line);
    const newHeading = lineText.startsWith("#") ? `#${lineText}` : `# ${lineText}`;
    codeMirrorInstance.replaceRange(newHeading, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: lineText.length });
  } else {
    newText = getFormattedText(type, selection);
    codeMirrorInstance.replaceSelection(newText);
  }
  codeMirrorInstance.focus();
}
function getFormattedText(type, selection) {
  switch (type) {
    case "bold":
      return `**${selection || "жирный текст"}**`;
    case "italic":
      return `*${selection || "курсивный текст"}*`;
    case "quote":
      return `> ${selection || "цитата"}`;
    case "ul":
      return `- ${selection || "элемент списка"}`;
    case "ol":
      return `1. ${selection || "элемент списка"}`;
    case "link":
      return `[${selection || "текст ссылки"}](https://)`;
    case "image":
      return `![описание изображения](https://){width="100%"}`;
    case "table":
      return `
| Заголовок 1 | Заголовок 2 | Заголовок 3 |
|-------------|-------------|-------------|
| Ячейка 1    | Ячейка 2    | Ячейка 3    |
| Ячейка 4    | Ячейка 5    | Ячейка 6    |
`;
    default:
      return selection;
  }
}
async function handleImageUpload(base64Data) {
  const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const placeholderText = `[Загрузка изображения ${uploadId}...]`;
  const cursor = codeMirrorInstance.getCursor();
  const lineText = codeMirrorInstance.getLine(cursor.line);
  const prevLineText = cursor.line > 0 ? codeMirrorInstance.getLine(cursor.line - 1) : "";
  let prefix = lineText.trim() !== "" || cursor.ch > 0 ? "\n\n" : prevLineText.trim() !== "" ? "\n" : "";
  let suffix = "\n\n";
  const fullPlaceholder = prefix + placeholderText + suffix;
  codeMirrorInstance.replaceSelection(fullPlaceholder);
  try {
    const result = await window.electronAPI.saveImage(base64Data);
    const currentText = codeMirrorInstance.getValue();
    if (result.success) {
      const finalMarkdown = prefix + `![изображение](${result.filePath}){width="100%"}` + suffix;
      codeMirrorInstance.setValue(currentText.replace(fullPlaceholder, finalMarkdown));
    } else {
      throw new Error(result.error || "Неизвестная ошибка сохранения");
    }
  } catch (error) {
    console.error("Ошибка загрузки изображения:", error);
    const currentText = codeMirrorInstance.getValue();
    const errorMarkdown = prefix + `[Ошибка загрузки изображения: ${error.message}]` + suffix;
    codeMirrorInstance.setValue(currentText.replace(fullPlaceholder, errorMarkdown));
  }
}
async function handlePaste(event) {
  const items = (event.clipboardData || window.clipboardData).items;
  for (const item of items) {
    if (item.type.indexOf("image") !== -1) {
      event.preventDefault();
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (e) => handleImageUpload(e.target.result);
      reader.readAsDataURL(blob);
      return;
    }
  }
}
async function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  codeMirrorInstance.getWrapperElement().style.backgroundColor = "transparent";
  const files = event.dataTransfer.files;
  for (const file of files) {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => handleImageUpload(e.target.result);
      reader.readAsDataURL(file);
      return;
    }
  }
}
console.log("[Module Loaded] state.js");
const state = {
  previewVisible: true,
  zoomLevel: 100,
  verticalOffset: 0,
  fileOffsets: /* @__PURE__ */ new Map(),
  currentFilePath: null,
  ui: {
    editorPane: null,
    previewPane: null,
    previewContainer: null,
    togglePreviewBtn: null,
    zoomLevelIndicator: null,
    syncOffsetIndicator: null
  }
};
function getState() {
  return { ...state };
}
function initializeState() {
  console.log("[State] Инициализация состояния и кэширование UI-элементов.");
  state.ui.editorPane = document.querySelector(".editor-pane");
  state.ui.previewPane = document.querySelector(".preview-pane");
  state.ui.previewContainer = document.getElementById("pdf-simulation-container");
  state.ui.togglePreviewBtn = document.getElementById("toggle-preview");
  state.ui.zoomLevelIndicator = document.getElementById("zoom-level");
  state.ui.syncOffsetIndicator = document.getElementById("sync-offset");
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateSyncIndicator();
}
function togglePreview() {
  state.previewVisible = !state.previewVisible;
  if (state.previewVisible) {
    state.ui.previewPane.classList.remove("hidden");
    state.ui.editorPane.classList.remove("fullwidth");
    state.ui.togglePreviewBtn.classList.add("active");
    state.ui.togglePreviewBtn.querySelector(".btn-text").textContent = "Превью";
    const editor = document.querySelector(".CodeMirror").CodeMirror;
    scheduleUpdate(editor.getValue());
  } else {
    state.ui.previewPane.classList.add("hidden");
    state.ui.editorPane.classList.add("fullwidth");
    state.ui.togglePreviewBtn.classList.remove("active");
    state.ui.togglePreviewBtn.querySelector(".btn-text").textContent = "Показать";
  }
  document.querySelector(".CodeMirror").CodeMirror.refresh();
}
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  console.log(`🎨 Тема изменена на: ${newTheme}`);
}
function setZoom(newZoom) {
  state.zoomLevel = Math.max(50, Math.min(200, newZoom));
  state.ui.previewContainer.style.transform = `scale(${state.zoomLevel / 100})`;
  state.ui.zoomLevelIndicator.textContent = `${state.zoomLevel}%`;
}
function zoomIn() {
  setZoom(state.zoomLevel + 10);
}
function zoomOut() {
  setZoom(state.zoomLevel - 10);
}
function resetZoom() {
  setZoom(100);
}
function adjustEditorOffset(delta) {
  state.verticalOffset += delta;
  applyOffset();
  updateSyncIndicator();
  if (state.currentFilePath) {
    state.fileOffsets.set(state.currentFilePath, state.verticalOffset);
  }
}
function resetOffset() {
  state.verticalOffset = 0;
  applyOffset();
  updateSyncIndicator();
  if (state.currentFilePath) {
    state.fileOffsets.set(state.currentFilePath, state.verticalOffset);
  }
}
function applyOffset() {
  const editorScroller = document.querySelector(".editor-pane .CodeMirror-scroll");
  if (editorScroller) {
    editorScroller.style.transform = `translateY(${state.verticalOffset}px)`;
  }
}
function updateSyncIndicator() {
  if (state.ui.syncOffsetIndicator) {
    state.ui.syncOffsetIndicator.textContent = `${state.verticalOffset}px`;
    state.ui.syncOffsetIndicator.classList.toggle("offset-active", state.verticalOffset !== 0);
  }
}
function setCurrentFile(filePath) {
  state.currentFilePath = filePath;
  state.verticalOffset = state.fileOffsets.get(filePath) || 0;
  applyOffset();
  updateSyncIndicator();
}
console.log("[Module Loaded] preview.js");
let isUpdatingPreview = false;
let currentHtmlContent = "";
let lastMarkdownText = "";
let renderQueue = [];
let isProcessingQueue = false;
let markdownCache = /* @__PURE__ */ new Map();
let stats = { totalRenders: 0, cacheHits: 0, renderTime: 0 };
function scheduleUpdate(markdownText) {
  const previewContainer = document.getElementById("pdf-simulation-container");
  if (!previewContainer || !getState().previewVisible) return;
  if (!renderQueue.includes(markdownText)) {
    renderQueue.push(markdownText);
  }
  processRenderQueue();
}
function processRenderQueue() {
  if (isProcessingQueue || renderQueue.length === 0) return;
  isProcessingQueue = true;
  requestAnimationFrame(async () => {
    const markdownText = renderQueue.pop();
    renderQueue = [];
    await updatePreviewIncremental(markdownText);
    isProcessingQueue = false;
    if (renderQueue.length > 0) processRenderQueue();
  });
}
async function updatePreviewIncremental(markdownText) {
  if (isUpdatingPreview || !getState().previewVisible) return;
  isUpdatingPreview = true;
  const startTime = performance.now();
  if (markdownText === lastMarkdownText) {
    isUpdatingPreview = false;
    return;
  }
  const isEmpty = !markdownText.trim();
  document.getElementById("save-pdf-btn").disabled = isEmpty;
  document.getElementById("save-md-btn").disabled = isEmpty;
  const previewContainer = document.getElementById("pdf-simulation-container");
  if (isEmpty) {
    previewContainer.innerHTML = "";
    const contentDiv = createPage();
    contentDiv.innerHTML = '<p style="color: #888;">Введите Markdown...</p>';
    lastMarkdownText = markdownText;
    isUpdatingPreview = false;
    return;
  }
  try {
    const blocks = splitIntoBlocks(markdownText);
    const renderedBlocks = await renderBlocks(blocks);
    currentHtmlContent = renderedBlocks.join("\n");
    await renderPages(currentHtmlContent);
    lastMarkdownText = markdownText;
    stats.totalRenders++;
    stats.renderTime = performance.now() - startTime;
    if (stats.totalRenders % 10 === 0) {
      console.log(`📊 Рендеринг #${stats.totalRenders}: ${stats.renderTime.toFixed(2)}ms, Кэш: ${stats.cacheHits}/${stats.totalRenders} (${(stats.cacheHits / stats.totalRenders * 100).toFixed(1)}%)`);
    }
  } catch (error) {
    console.error("Ошибка рендеринга:", error);
  } finally {
    isUpdatingPreview = false;
  }
}
function splitIntoBlocks(markdown) {
  const blocks = [];
  const lines = markdown.split("\n");
  let currentBlock = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        if (currentBlock.length > 0) blocks.push({ type: "markdown", content: currentBlock.join("\n") });
        currentBlock = [];
        inCodeBlock = true;
        codeBlockLang = line.trim().substring(3);
        currentBlock.push(line);
      } else {
        currentBlock.push(line);
        blocks.push({ type: "code", lang: codeBlockLang, content: currentBlock.join("\n") });
        currentBlock = [];
        inCodeBlock = false;
        codeBlockLang = "";
      }
      continue;
    }
    if (inCodeBlock) {
      currentBlock.push(line);
      continue;
    }
    if (line.trim() === "") {
      if (currentBlock.length > 0) blocks.push({ type: "markdown", content: currentBlock.join("\n") });
      currentBlock = [];
      blocks.push({ type: "empty", content: "" });
    } else if (line.match(/^#{1,6}\s/)) {
      if (currentBlock.length > 0) blocks.push({ type: "markdown", content: currentBlock.join("\n") });
      currentBlock = [];
      blocks.push({ type: "heading", content: line });
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push({ type: inCodeBlock ? "code" : "markdown", content: currentBlock.join("\n") });
  }
  return blocks;
}
async function renderBlocks(blocks) {
  const rendered = [];
  for (const block of blocks) {
    if (block.type === "empty") {
      rendered.push("");
      continue;
    }
    const cacheKey = `${block.type}:${block.content}`;
    if (markdownCache.has(cacheKey)) {
      rendered.push(markdownCache.get(cacheKey));
      stats.cacheHits++;
      continue;
    }
    const html = await window.electronAPI.convertMarkdown(block.content);
    markdownCache.set(cacheKey, html);
    rendered.push(html);
    if (markdownCache.size > 1e3) {
      const firstKey = markdownCache.keys().next().value;
      markdownCache.delete(firstKey);
    }
  }
  return rendered;
}
async function renderPages(htmlContent) {
  const scrollY = window.scrollY;
  const previewContainer = document.getElementById("pdf-simulation-container");
  previewContainer.innerHTML = "";
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = htmlContent;
  const pageElementForSizing = document.createElement("div");
  pageElementForSizing.className = "page";
  pageElementForSizing.style.visibility = "hidden";
  pageElementForSizing.style.position = "absolute";
  pageElementForSizing.style.top = "-9999px";
  document.body.appendChild(pageElementForSizing);
  const rawPageHeight = pageElementForSizing.clientHeight - parseFloat(getComputedStyle(pageElementForSizing).paddingTop) * 2;
  const SAFETY_MARGIN = 0.96;
  const pageContentHeight = Math.floor(rawPageHeight * SAFETY_MARGIN);
  const TABLE_THRESHOLD = pageContentHeight / 4;
  document.body.removeChild(pageElementForSizing);
  let currentPageContent = createPage();
  const allNodes = Array.from(tempDiv.childNodes);
  for (const node of allNodes) {
    if (node.nodeName === "PRE") {
      const clonedNode = node.cloneNode(true);
      currentPageContent.appendChild(clonedNode);
      if (currentPageContent.scrollHeight > pageContentHeight) {
        clonedNode.remove();
        const codeElement = node.querySelector("code");
        if (!codeElement) continue;
        const lines = codeElement.innerHTML.split("\n");
        let currentPre = document.createElement("pre");
        let currentCode = document.createElement("code");
        if (codeElement.className) {
          currentCode.className = codeElement.className;
        }
        currentPre.appendChild(currentCode);
        currentPageContent.appendChild(currentPre);
        if (currentPageContent.scrollHeight > pageContentHeight) {
          currentPre.remove();
          currentPageContent = createPage();
          currentPageContent.appendChild(currentPre);
        }
        for (const line of lines) {
          const prevHtml = currentCode.innerHTML;
          currentCode.innerHTML += (prevHtml ? "\n" : "") + line;
          if (currentPageContent.scrollHeight > pageContentHeight) {
            currentCode.innerHTML = prevHtml;
            currentPageContent = createPage();
            currentPre = document.createElement("pre");
            currentCode = document.createElement("code");
            if (codeElement.className) {
              currentCode.className = codeElement.className;
            }
            currentPre.appendChild(currentCode);
            currentPageContent.appendChild(currentPre);
            currentCode.innerHTML = line;
          }
        }
      }
    } else if (node.nodeName === "TABLE") {
      let splitTable2 = function(tableNode) {
        const thead = tableNode.querySelector("thead")?.cloneNode(true);
        const rows = Array.from(tableNode.querySelectorAll("tbody tr"));
        if (rows.length === 0) {
          currentPageContent.appendChild(tableNode.cloneNode(true));
          return;
        }
        let currentTable = document.createElement("table");
        if (thead) currentTable.appendChild(thead.cloneNode(true));
        let currentTbody = currentTable.appendChild(document.createElement("tbody"));
        currentPageContent.appendChild(currentTable);
        if (currentPageContent.scrollHeight > pageContentHeight) {
          currentTable.remove();
          currentPageContent = createPage();
          currentPageContent.appendChild(currentTable);
        }
        for (const row of rows) {
          currentTbody.appendChild(row.cloneNode(true));
          if (currentPageContent.scrollHeight > pageContentHeight) {
            currentTbody.lastChild.remove();
            currentPageContent = createPage();
            currentTable = document.createElement("table");
            if (thead) currentTable.appendChild(thead.cloneNode(true));
            currentTbody = currentTable.appendChild(document.createElement("tbody"));
            currentPageContent.appendChild(currentTable);
            currentTbody.appendChild(row.cloneNode(true));
          }
        }
      };
      var splitTable = splitTable2;
      const tableCloneForMeasure = node.cloneNode(true);
      pageElementForSizing.innerHTML = "";
      pageElementForSizing.appendChild(tableCloneForMeasure);
      document.body.appendChild(pageElementForSizing);
      const fullTableHeight = tableCloneForMeasure.offsetHeight;
      document.body.removeChild(pageElementForSizing);
      const initialPageScrollHeight = currentPageContent.scrollHeight;
      currentPageContent.appendChild(node.cloneNode(true));
      const heightAfterAdd = currentPageContent.scrollHeight;
      currentPageContent.lastChild.remove();
      const fitsOnPage = heightAfterAdd <= pageContentHeight;
      if (fullTableHeight < TABLE_THRESHOLD) {
        if (fitsOnPage) {
          currentPageContent.appendChild(node.cloneNode(true));
        } else {
          currentPageContent = createPage();
          currentPageContent.appendChild(node.cloneNode(true));
        }
      } else {
        const spaceLeft = pageContentHeight - initialPageScrollHeight;
        const visiblePartHeight = Math.min(spaceLeft, fullTableHeight);
        if (visiblePartHeight < TABLE_THRESHOLD && !fitsOnPage) {
          currentPageContent = createPage();
          currentPageContent.appendChild(node.cloneNode(true));
          if (currentPageContent.scrollHeight > pageContentHeight) {
            currentPageContent.lastChild.remove();
            splitTable2(node);
          }
        } else {
          splitTable2(node);
        }
      }
    } else {
      const clonedNode = node.cloneNode(true);
      currentPageContent.appendChild(clonedNode);
      if (currentPageContent.scrollHeight > pageContentHeight) {
        if (currentPageContent.childElementCount > 1) {
          currentPageContent.removeChild(clonedNode);
          currentPageContent = createPage();
          currentPageContent.appendChild(clonedNode);
        } else {
          currentPageContent = createPage();
        }
      }
    }
  }
  const lastPage = previewContainer.querySelector(".page:last-child .markdown-body");
  if (lastPage && lastPage.innerHTML.trim() === "") {
    lastPage.parentElement.remove();
  }
  syncPaneHeights();
  window.scrollTo(0, scrollY);
}
function createPage() {
  const page = document.createElement("div");
  page.className = "page";
  const content = document.createElement("div");
  content.className = "markdown-body";
  page.appendChild(content);
  document.getElementById("pdf-simulation-container").appendChild(page);
  return content;
}
function syncPaneHeights() {
  const editorPane = document.querySelector(".editor-pane");
  const previewPane = document.querySelector(".preview-pane");
  const { zoomLevel } = getState();
  const minHeight = `calc(100vh - 50px)`;
  editorPane.style.minHeight = minHeight;
  previewPane.style.minHeight = minHeight;
  const editorHeight = editorPane.scrollHeight;
  const previewHeight = previewPane.scrollHeight * (zoomLevel / 100);
  const maxHeight = Math.max(editorHeight, previewHeight);
  editorPane.style.height = `${maxHeight}px`;
  previewPane.style.height = `${maxHeight}px`;
}
function resetPreviewState() {
  markdownCache.clear();
  lastMarkdownText = "";
}
function getPreviewHtmlContent() {
  const previewContainer = document.getElementById("pdf-simulation-container");
  return Array.from(previewContainer.querySelectorAll(".page .markdown-body")).map((pageContent) => pageContent.innerHTML).join('<div style="page-break-after: always;"></div>');
}
console.log("[Module Loaded] toolbar.js");
function initializeToolbar(editorInstance2) {
  document.getElementById("btn-bold").addEventListener("click", () => applyMarkdown("bold"));
  document.getElementById("btn-italic").addEventListener("click", () => applyMarkdown("italic"));
  document.getElementById("btn-heading").addEventListener("click", () => applyMarkdown("heading"));
  document.getElementById("btn-quote").addEventListener("click", () => applyMarkdown("quote"));
  document.getElementById("btn-ul").addEventListener("click", () => applyMarkdown("ul"));
  document.getElementById("btn-ol").addEventListener("click", () => applyMarkdown("ol"));
  document.getElementById("btn-link").addEventListener("click", () => applyMarkdown("link"));
  document.getElementById("btn-image").addEventListener("click", () => applyMarkdown("image"));
  document.getElementById("btn-table").addEventListener("click", () => applyMarkdown("table"));
  document.getElementById("btn-linebreak").addEventListener("click", () => insertLineBreak(editorInstance2));
  document.getElementById("toggle-preview").addEventListener("click", togglePreview);
  document.getElementById("zoom-in").addEventListener("click", zoomIn);
  document.getElementById("zoom-out").addEventListener("click", zoomOut);
  document.getElementById("zoom-reset").addEventListener("click", resetZoom);
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  document.getElementById("sync-up").addEventListener("click", () => adjustEditorOffset(-20));
  document.getElementById("sync-down").addEventListener("click", () => adjustEditorOffset(20));
  document.getElementById("sync-reset").addEventListener("click", resetOffset);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      togglePreview();
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      toggleTheme();
    }
    if (e.shiftKey && e.key === "0") {
      e.preventDefault();
      resetOffset();
    }
  });
  document.addEventListener("wheel", (e) => {
    if (e.shiftKey) {
      e.preventDefault();
      const scrollSpeedMultiplier = 1;
      const delta = e.deltaY * scrollSpeedMultiplier;
      adjustEditorOffset(delta);
    }
  }, { passive: false });
}
console.log("[Module Loaded] file-io.js");
let editorInstance;
function initializeFileIO(cmInstance) {
  editorInstance = cmInstance;
  document.getElementById("open-btn").addEventListener("click", handleOpenFile);
  document.getElementById("save-md-btn").addEventListener("click", handleSaveMd);
  document.getElementById("save-pdf-btn").addEventListener("click", handleSavePdf);
}
async function handleOpenFile() {
  const openBtn = document.getElementById("open-btn");
  try {
    const result = await window.electronAPI.openFile();
    if (result && result.content !== void 0) {
      setButtonLoading(openBtn, true, "Загрузка...");
      await loadFileContent(result.content, result.filePath);
      setButtonLoading(openBtn, false, "Открыть");
    }
  } catch (error) {
    console.error("Ошибка при открытии файла:", error);
    setButtonLoading(openBtn, false, "Открыть");
    alert("Ошибка при открытии файла: " + error.message);
  }
}
async function loadFileContent(content, filePath) {
  if (!editorInstance) return;
  setCurrentFile(filePath);
  resetPreviewState();
  editorInstance.setValue(content);
  editorInstance.refresh();
  editorInstance.focus();
  editorInstance.setCursor(0, 0);
  await new Promise((resolve) => setTimeout(resolve, 50));
  scheduleUpdate(content);
}
async function handleSaveMd() {
  const saveMdBtn = document.getElementById("save-md-btn");
  const content = editorInstance.getValue();
  if (!content.trim()) {
    alert("Нечего сохранять");
    return;
  }
  setButtonLoading(saveMdBtn, true, "Сохранение...");
  try {
    const result = await window.electronAPI.saveMdFile(content);
    if (result.success) {
      alert(`Файл успешно сохранен в: ${result.filePath}`);
    } else if (result.error) {
      alert(`Ошибка сохранения: ${result.error}`);
    }
  } catch (error) {
    alert(`Критическая ошибка сохранения: ${error.message}`);
  } finally {
    setButtonLoading(saveMdBtn, false, "Сохранить MD");
  }
}
async function handleSavePdf() {
  const savePdfBtn = document.getElementById("save-pdf-btn");
  const pagesHtml = getPreviewHtmlContent();
  if (!pagesHtml.trim()) {
    alert("Нечего сохранять");
    return;
  }
  setButtonLoading(savePdfBtn, true, "Экспорт...");
  try {
    const result = await window.electronAPI.savePdf(pagesHtml);
    if (result.success) {
      alert(`PDF успешно сохранен в: ${result.filePath}`);
    } else if (result.error) {
      alert(`Ошибка сохранения: ${result.error}`);
    }
  } catch (error) {
    alert(`Ошибка сохранения: ${error.message}`);
  } finally {
    setButtonLoading(savePdfBtn, false, "Экспорт PDF");
  }
}
function setButtonLoading(button, isLoading, text) {
  const textSpan = button.querySelector(".btn-text");
  button.disabled = isLoading;
  if (textSpan) {
    textSpan.textContent = text;
  }
}
console.log("[Renderer] renderer.js: Скрипт начал выполняться.");
console.log("[Renderer] renderer.js: Модуль editor.js импортирован.");
console.log("[Renderer] renderer.js: Модуль preview.js импортирован.");
console.log("[Renderer] renderer.js: Модуль toolbar.js импортирован.");
console.log("[Renderer] renderer.js: Модуль state.js импортирован.");
console.log("[Renderer] renderer.js: Модуль file-io.js импортирован.");
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Renderer] DOMContentLoaded: DOM полностью загружен и разобран.");
  try {
    console.log("[Renderer] DOMContentLoaded: 1. Инициализация состояния...");
    initializeState();
    console.log("[Renderer] DOMContentLoaded: 2. Инициализация редактора...");
    const editor = initializeEditor();
    console.log("[Renderer] DOMContentLoaded: 3. Инициализация панели инструментов...");
    initializeToolbar(editor);
    console.log("[Renderer] DOMContentLoaded: 4. Инициализация файлового ввода/вывода...");
    initializeFileIO(editor);
    console.log("[Renderer] DOMContentLoaded: 5. Настройка обработчика изменений редактора...");
    let typingTimer;
    editor.on("change", (cm, changeObj) => {
      clearTimeout(typingTimer);
      const changeSize = Math.abs(changeObj.text.join("").length - (changeObj.removed?.join("").length || 0));
      const isBigChange = changeSize > 100;
      const delay = isBigChange ? 1e3 : 300;
      typingTimer = setTimeout(() => {
        scheduleUpdate(editor.getValue());
      }, delay);
    });
    console.log("[Renderer] DOMContentLoaded: Первоначальный рендеринг превью...");
    scheduleUpdate(editor.getValue());
    console.log("✅ [Renderer] Модульное приложение успешно инициализировано!");
  } catch (error) {
    console.error("❌ [Renderer] КРИТИЧЕСКАЯ ОШИБКА во время инициализации:", error);
  }
});
