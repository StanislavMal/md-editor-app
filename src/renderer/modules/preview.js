// src/renderer/modules/preview.js
console.log('[Module Loaded] preview.js');

// --- Состояние модуля ---
let updateTimeoutId = null;
let currentPaginationProcessId = 0;
const DEBOUNCE_DELAY = 30; // мс
let onScrollCallback = () => {};

// --- UI Элементы ---
const previewPane = document.querySelector('.preview-pane');
const previewContainer = document.getElementById('pdf-simulation-container');
let previewContent;

/**
 * Инициализирует DOM-структуру для превью.
 */
function initializePreviewDOM() {
    previewContent = document.createElement('div');
    previewContent.id = 'preview-content';
    previewContent.className = 'markdown-body';
    previewPane.appendChild(previewContent);
    previewPane.addEventListener('scroll', handlePreviewScroll);
}

// --- НОВЫЕ ФУНКЦИИ ДЛЯ СИНХРОНИЗАЦИИ ---

export function setOnScrollCallback(callback) {
    onScrollCallback = callback;
}

/**
 * Обрабатывает скролл панели превью.
 */
function handlePreviewScroll() {
    const previewRect = previewPane.getBoundingClientRect();
    const elements = previewContainer.querySelectorAll('[data-line]');
    
    let topElement = null;

    for (const el of elements) {
        const elRect = el.getBoundingClientRect();
        if (elRect.top <= previewRect.top) {
            topElement = el;
        } else {
            break;
        }
    }
    
    if (topElement) {
        const line = parseInt(topElement.dataset.line, 10);
        if (!isNaN(line)) {
            onScrollCallback(line, previewPane);
        }
    } else {
        // Если видимых элементов нет (например, пустой документ),
        // все равно отправляем событие, чтобы обработать scrollTop === 0
        onScrollCallback(1, previewPane);
    }
}


/**
 * Программно прокручивает превью к элементу, соответствующему строке.
 * @param {number} line - Номер строки (1-based index).
 */
export function scrollToText(line) {
    if (!previewContainer || !line) return;

    const elements = Array.from(previewContainer.querySelectorAll('[data-line]'));
    let targetElement = null;

    // Ищем элемент, чей data-line наиболее близок (сверху) к искомой строке
    for (const el of elements) {
        const elLine = parseInt(el.dataset.line, 10);
        if (elLine >= line) {
            targetElement = el;
            break;
        }
        targetElement = el;
    }

    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
}

export function scheduleUpdate(markdownText) {
    clearTimeout(updateTimeoutId);
    updateTimeoutId = setTimeout(() => {
        updatePreview(markdownText);
    }, DEBOUNCE_DELAY);
}
async function updatePreview(markdownText) {
    currentPaginationProcessId++;
    if (!markdownText.trim()) {
        previewContainer.innerHTML = '';
        previewContainer.appendChild(createPage());
        return;
    }

    const html = await window.electronAPI.convertMarkdown(markdownText);
    previewContent.innerHTML = html;
    paginateAndRender(previewContent.children);
}
async function paginateAndRender(nodes) {
    const processId = currentPaginationProcessId;

    const measurementContainer = document.createElement('div');
    measurementContainer.style.position = 'absolute';
    measurementContainer.style.visibility = 'hidden';
    measurementContainer.style.left = '-9999px';
    document.body.appendChild(measurementContainer);

    const pageSizer = createPage();
    measurementContainer.appendChild(pageSizer);
    const pageContentHeight = pageSizer.clientHeight;
    measurementContainer.removeChild(pageSizer);

    if (pageContentHeight <= 0) {
        console.error("Не удалось измерить высоту страницы. Пагинация отменена.");
        document.body.removeChild(measurementContainer);
        return;
    }

    const pages = [];
    let currentPage = createPage();
    measurementContainer.appendChild(currentPage);

    for (const node of Array.from(nodes)) {
        if (processId !== currentPaginationProcessId) {
            document.body.removeChild(measurementContainer);
            return;
        }

        if (node.nodeName === 'PRE') {
            currentPage = handlePreBlock(node, currentPage, pages, measurementContainer, pageContentHeight);
        } else if (node.nodeName === 'TABLE') {
            currentPage = handleTableBlock(node, currentPage, pages, measurementContainer, pageContentHeight);
        } else {
            currentPage = handleDefaultNode(node, currentPage, pages, measurementContainer, pageContentHeight);
        }
        
        if (pages.length % 5 === 0) {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }

    if (currentPage.querySelector('.markdown-body').childElementCount > 0) {
        pages.push(currentPage);
    }
    
    document.body.removeChild(measurementContainer);
    
    if (processId === currentPaginationProcessId) {
        const scrollY = previewPane.scrollTop;
        previewContainer.innerHTML = '';
        pages.forEach(page => previewContainer.appendChild(page));
        previewPane.scrollTop = scrollY;
    }
}
function handleDefaultNode(node, currentPage, pages, measurementContainer, pageContentHeight) {
    let currentPageContent = currentPage.querySelector('.markdown-body');
    const nodeClone = node.cloneNode(true);
    currentPageContent.appendChild(nodeClone);

    if (currentPageContent.scrollHeight > pageContentHeight) {
        if (currentPageContent.childElementCount > 1) {
            nodeClone.remove();
            pages.push(currentPage);
            currentPage = createPage();
            currentPage.querySelector('.markdown-body').appendChild(node.cloneNode(true));
            measurementContainer.innerHTML = '';
            measurementContainer.appendChild(currentPage);
        }
    }
    return currentPage;
}
function handlePreBlock(node, currentPage, pages, measurementContainer, pageContentHeight) {
    let currentPageContent = currentPage.querySelector('.markdown-body');
    const codeElement = node.querySelector('code');
    if (!codeElement) {
        return handleDefaultNode(node, currentPage, pages, measurementContainer, pageContentHeight);
    }

    const lineSpans = Array.from(codeElement.children);
    
    currentPageContent.appendChild(node.cloneNode(true));
    if (currentPageContent.scrollHeight <= pageContentHeight) {
        return currentPage;
    }
    currentPageContent.lastChild.remove();

    if (currentPageContent.scrollHeight > pageContentHeight - 50 && currentPageContent.childElementCount > 0) {
         pages.push(currentPage);
         currentPage = createPage();
         currentPageContent = currentPage.querySelector('.markdown-body');
         measurementContainer.innerHTML = '';
         measurementContainer.appendChild(currentPage);
    }
    
    let currentPre = node.cloneNode(false);
    let currentCode = codeElement.cloneNode(false);
    currentPre.appendChild(currentCode);
    currentPageContent.appendChild(currentPre);

    for (const span of lineSpans) {
        currentCode.appendChild(span.cloneNode(true));

        if (currentPageContent.scrollHeight > pageContentHeight) {
            currentCode.lastChild.remove();
            pages.push(currentPage);
            
            currentPage = createPage();
            currentPageContent = currentPage.querySelector('.markdown-body');
            measurementContainer.innerHTML = '';
            measurementContainer.appendChild(currentPage);
            
            currentPre = node.cloneNode(false);
            currentCode = codeElement.cloneNode(false);
            currentPre.appendChild(currentCode);
            currentPageContent.appendChild(currentPre);
            
            currentCode.appendChild(span.cloneNode(true));
        }
    }
    return currentPage;
}
function handleTableBlock(node, currentPage, pages, measurementContainer, pageContentHeight) {
    let currentPageContent = currentPage.querySelector('.markdown-body');
    const thead = node.querySelector('thead')?.cloneNode(true);
    const rows = Array.from(node.querySelectorAll('tbody tr'));

    currentPageContent.appendChild(node.cloneNode(true));
    if (currentPageContent.scrollHeight <= pageContentHeight) {
        return currentPage;
    }
    currentPageContent.lastChild.remove();
    
    if (currentPageContent.scrollHeight > pageContentHeight - 100 && currentPageContent.childElementCount > 0) {
         pages.push(currentPage);
         currentPage = createPage();
         currentPageContent = currentPage.querySelector('.markdown-body');
         measurementContainer.innerHTML = '';
         measurementContainer.appendChild(currentPage);
    }

    let currentTable = node.cloneNode(false);
    if (thead) currentTable.appendChild(thead.cloneNode(true));
    let currentTbody = currentTable.appendChild(document.createElement('tbody'));
    currentPageContent.appendChild(currentTable);

    for (const row of rows) {
        currentTbody.appendChild(row.cloneNode(true));
        if (currentPageContent.scrollHeight > pageContentHeight) {
            currentTbody.lastChild.remove();
            pages.push(currentPage);
            
            currentPage = createPage();
            currentPageContent = currentPage.querySelector('.markdown-body');
            measurementContainer.innerHTML = '';
            measurementContainer.appendChild(currentPage);
            
            currentTable = node.cloneNode(false);
            if (thead) currentTable.appendChild(thead.cloneNode(true));
            currentTbody = currentTable.appendChild(document.createElement('tbody'));
            currentPageContent.appendChild(currentTable);
            currentTbody.appendChild(row.cloneNode(true));
        }
    }
    return currentPage;
}
function createPage() {
    const page = document.createElement('div');
    page.className = 'page';
    const content = document.createElement('div');
    content.className = 'markdown-body';
    page.appendChild(content);
    return page;
}
export function resetPreviewState() {
    clearTimeout(updateTimeoutId);
    currentPaginationProcessId++;
    previewContent.innerHTML = '';
    previewContainer.innerHTML = '';
}
export function getPreviewHtmlContent() {
    return Array.from(previewContainer.querySelectorAll('.page'))
        .map(page => page.outerHTML)
        .join('');
}
initializePreviewDOM();
