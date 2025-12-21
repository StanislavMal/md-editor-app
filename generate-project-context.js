#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ========== КОНФИГУРАЦИЯ ==========

const CONFIG = {
    // Папки которые нужно игнорировать
    ignoreDirs: [
        'node_modules',
        '.git',
        'dist',
        'build',
        'wailsjs',
        '.idea',
        '.vscode',
        'vendor',
        'tmp',
        'temp',
        '.wails-build',
    ],

    // Папки, содержимое которых не нужно включать (но они должны быть в дереве файлов)
    ignoreContentDirs: [
        'out'                
    ],

    // Файлы которые нужно игнорировать
    ignoreFiles: [
        '.DS_Store',
        'Thumbs.db',
        '.gitignore',
        'package-lock.json',
        'generate-project-context.js',
        'PROJECT_CONTEXT.md',
        'OFL.txt',
        'yarn.lock',
        'go.sum',
        '*.exe',
        '*.dll',
        '*.so',
        '*.dylib',
        '*.log',
    ],

    // Расширения файлов для включения в полный вывод
    includeExtensions: [
        '.go',
        '.js',
        '.html',
        '.css',
        '.json',
        '.md',
        '.txt',
        '.yml',
        '.yaml',
        '.toml',
        '.mod',
        '.sum',
    ],

    // Максимальный размер файла для включения (в байтах)
    maxFileSize: 500 * 1024, // 500KB

    // Выходной файл
    outputFile: 'PROJECT_CONTEXT.md',
};

// ========== УТИЛИТЫ ==========

/**
 * Проверяет, нужно ли игнорировать директорию
 */
function shouldIgnoreDir(dirName) {
    return CONFIG.ignoreDirs.includes(dirName) || dirName.startsWith('.');
}

/**
 * Проверяет, нужно ли игнорировать файл
 */
function shouldIgnoreFile(fileName) {
    // Скрытые файлы
    if (fileName.startsWith('.') && fileName !== '.env.example') {
        return true;
    }

    // Точное совпадение
    if (CONFIG.ignoreFiles.includes(fileName)) {
        return true;
    }

    // Паттерны
    for (const pattern of CONFIG.ignoreFiles) {
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            if (regex.test(fileName)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Проверяет, нужно ли включать содержимое файла
 */
function shouldIncludeContent(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const stats = fs.statSync(filePath);

    // Игнорируем содержимое файлов из папок, указанных в ignoreContentDirs
    if (CONFIG.ignoreContentDirs.some(dir => filePath.includes(`${path.sep}${dir}${path.sep}`))) {
        return false;
    }

    // Проверка размера
    if (stats.size > CONFIG.maxFileSize) {
        return false;
    }

    // Проверка расширения
    return CONFIG.includeExtensions.includes(ext);
}

/**
 * Получает тип файла по расширению
 */
function getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
        '.go': 'Go',
        '.js': 'JavaScript',
        '.html': 'HTML',
        '.css': 'CSS',
        '.json': 'JSON',
        '.md': 'Markdown',
        '.yml': 'YAML',
        '.yaml': 'YAML',
        '.toml': 'TOML',
        '.txt': 'Text',
        '.mod': 'Go Module',
        '.sum': 'Go Sum',
    };
    return typeMap[ext] || 'Other';
}

/**
 * Форматирует размер файла
 */
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Получает текущую дату и время
 */
function getCurrentDateTime() {
    return new Date().toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

// ========== СКАНИРОВАНИЕ ПРОЕКТА ==========

class ProjectScanner {
    constructor(rootPath) {
        this.rootPath = rootPath;
        this.files = [];
        this.stats = {
            totalFiles: 0,
            totalSize: 0,
            filesByType: {},
            totalLines: 0,
        };
    }

    /**
     * Сканирует проект
     */
    scan() {
        this._scanDirectory(this.rootPath, '');
        return {
            files: this.files,
            stats: this.stats,
        };
    }

    /**
     * Рекурсивно сканирует директорию
     */
    _scanDirectory(dirPath, relativePath) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relPath = path.join(relativePath, entry.name);

            if (entry.isDirectory()) {
                if (!shouldIgnoreDir(entry.name)) {
                    this._scanDirectory(fullPath, relPath);
                }
            } else if (entry.isFile()) {
                if (!shouldIgnoreFile(entry.name)) {
                    this._processFile(fullPath, relPath);
                }
            }
        }
    }

    /**
     * Обрабатывает файл
     */
    _processFile(fullPath, relativePath) {
        const stats = fs.statSync(fullPath);
        const fileType = getFileType(fullPath);

        // Обновляем статистику
        this.stats.totalFiles++;
        this.stats.totalSize += stats.size;
        this.stats.filesByType[fileType] = (this.stats.filesByType[fileType] || 0) + 1;

        const fileInfo = {
            path: relativePath,
            fullPath: fullPath,
            name: path.basename(fullPath),
            type: fileType,
            size: stats.size,
            includeContent: shouldIncludeContent(fullPath),
        };

        // Читаем содержимое если нужно
        if (fileInfo.includeContent) {
            try {
                const content = fs.readFileSync(fullPath, 'utf8');
                fileInfo.content = content;
                fileInfo.lines = content.split('\n').length;
                this.stats.totalLines += fileInfo.lines;
            } catch (error) {
                fileInfo.content = `[Ошибка чтения: ${error.message}]`;
                fileInfo.includeContent = false;
            }
        }

        this.files.push(fileInfo);
    }
}

// ========== ГЕНЕРАЦИЯ ОТЧЕТА ==========

class ReportGenerator {
    constructor(projectData, projectName) {
        this.data = projectData;
        this.projectName = projectName;
        this.output = [];
    }

    /**
     * Генерирует отчет
     */
    generate() {
        this._writeHeader();
        this._writeStats();
        this._writeStructure();
        this._writeFileContents();
        this._writeFooter();

        return this.output.join('\n');
    }

    /**
     * Записывает заголовок
     */
    _writeHeader() {
        this.output.push('# 📦 Контекст проекта для AI-программиста');
        this.output.push('');
        this.output.push(`**Проект:** ${this.projectName}`);
        this.output.push(`**Дата генерации:** ${getCurrentDateTime()}`);
        this.output.push('');
        this.output.push('---');
        this.output.push('');
    }

    /**
     * Записывает статистику
     */
    _writeStats() {
        this.output.push('## 📊 Статистика проекта');
        this.output.push('');
        this.output.push(`- **Всего файлов:** ${this.data.stats.totalFiles}`);
        this.output.push(`- **Общий размер:** ${formatSize(this.data.stats.totalSize)}`);
        this.output.push(`- **Строк кода:** ${this.data.stats.totalLines.toLocaleString()}`);
        this.output.push('');
        this.output.push('### Файлы по типам:');
        this.output.push('');

        const sortedTypes = Object.entries(this.data.stats.filesByType)
            .sort((a, b) => b[1] - a[1]);

        for (const [type, count] of sortedTypes) {
            this.output.push(`- **${type}:** ${count}`);
        }

        this.output.push('');
        this.output.push('---');
        this.output.push('');
    }

    /**
     * Записывает структуру проекта
     */
    _writeStructure() {
        this.output.push('## 📁 Структура проекта');
        this.output.push('');
        this.output.push('```');

        // Группируем файлы по директориям
        const tree = this._buildTree();
        this._printTree(tree, '', true);

        this.output.push('```');
        this.output.push('');
        this.output.push('---');
        this.output.push('');
    }

    /**
     * Строит дерево файлов
     */
    _buildTree() {
        const tree = {};

        for (const file of this.data.files) {
            const parts = file.path.split(path.sep);
            let current = tree;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    // Файл
                    if (!current._files) current._files = [];
                    current._files.push(part);
                } else {
                    // Директория
                    if (!current[part]) current[part] = {};
                    current = current[part];
                }
            }
        }

        return tree;
    }

    /**
     * Выводит дерево
     */
    _printTree(tree, prefix = '', isRoot = false) {
        const dirs = Object.keys(tree).filter(k => k !== '_files').sort();
        const files = tree._files || [];

        // Директории
        dirs.forEach((dir, index) => {
            const isLast = index === dirs.length - 1 && files.length === 0;
            const marker = isLast ? '└── ' : '├── ';
            this.output.push(prefix + marker + dir + '/');

            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            this._printTree(tree[dir], newPrefix);
        });

        // Файлы
        files.sort().forEach((file, index) => {
            const isLast = index === files.length - 1;
            const marker = isLast ? '└── ' : '├── ';
            this.output.push(prefix + marker + file);
        });
    }

    /**
     * Записывает содержимое файлов
     */
    _writeFileContents() {
        this.output.push('## 📄 Содержимое файлов');
        this.output.push('');

        // Сортируем файлы по важности
        const sortedFiles = this._sortFilesByImportance();

        for (const file of sortedFiles) {
            if (!file.includeContent) continue;

            this.output.push(`### \`${file.path}\``);
            this.output.push('');
            this.output.push(`**Тип:** ${file.type} | **Размер:** ${formatSize(file.size)} | **Строк:** ${file.lines || 0}`);
            this.output.push('');

            // Определяем язык для подсветки синтаксиса
            const lang = this._getLanguageForHighlight(file.type);
            this.output.push('```' + lang);
            this.output.push(file.content);
            this.output.push('```');
            this.output.push('');
            this.output.push('---');
            this.output.push('');
        }
    }

    /**
     * Сортирует файлы по важности
     */
    _sortFilesByImportance() {
        const priority = {
            'README.md': 1,
            'go.mod': 2,
            'package.json': 3,
            'wails.json': 4,
            'main.go': 5,
            'app.go': 6,
            'types.go': 7,
            'index.html': 8,
            'main.js': 9,
            'style.css': 10,
        };

        return [...this.data.files].sort((a, b) => {
            const aPrio = priority[a.name] || 100;
            const bPrio = priority[b.name] || 100;

            if (aPrio !== bPrio) {
                return aPrio - bPrio;
            }

            return a.path.localeCompare(b.path);
        });
    }

    /**
     * Получает язык для подсветки синтаксиса
     */
    _getLanguageForHighlight(fileType) {
        const map = {
            'Go': 'go',
            'JavaScript': 'javascript',
            'HTML': 'html',
            'CSS': 'css',
            'JSON': 'json',
            'Markdown': 'markdown',
            'YAML': 'yaml',
            'TOML': 'toml',
            'Text': 'text',
            'Go Module': 'go',
        };
        return map[fileType] || '';
    }

    /**
     * Записывает футер
     */
    _writeFooter() {
        this.output.push('---');
        this.output.push('');
        this.output.push('## 📝 Примечания');
        this.output.push('');
        this.output.push('Этот файл был автоматически сгенерирован для предоставления полного контекста проекта AI-программисту.');
        this.output.push('');
        this.output.push('**Что включено:**');
        this.output.push('- Полная структура проекта');
        this.output.push('- Статистика по файлам');
        this.output.push('- Содержимое всех исходных файлов');
        this.output.push('');
        this.output.push('**Что исключено:**');
        this.output.push('- node_modules, build, dist');
        this.output.push('- .git и другие служебные папки');
        this.output.push('- Бинарные файлы');
        this.output.push('- Файлы > 500KB');
        this.output.push('');
        this.output.push(`**Сгенерировано:** ${getCurrentDateTime()}`);
    }
}

// ========== MAIN ==========

function main() {
    console.log('🔍 Сканирование проекта...\n');

    const rootPath = process.cwd();
    const projectName = path.basename(rootPath);

    // Сканируем проект
    const scanner = new ProjectScanner(rootPath);
    const projectData = scanner.scan();

    console.log(`✅ Найдено файлов: ${projectData.stats.totalFiles}`);
    console.log(`📦 Общий размер: ${formatSize(projectData.stats.totalSize)}`);
    console.log(`📝 Строк кода: ${projectData.stats.totalLines.toLocaleString()}\n`);

    // Генерируем отчет
    console.log('📝 Генерация отчета...\n');
    const generator = new ReportGenerator(projectData, projectName);
    const report = generator.generate();

    // Записываем в файл
    const outputPath = path.join(rootPath, CONFIG.outputFile);
    fs.writeFileSync(outputPath, report, 'utf8');

    console.log(`✅ Отчет сохранен: ${CONFIG.outputFile}`);
    console.log(`📊 Размер отчета: ${formatSize(Buffer.byteLength(report, 'utf8'))}\n`);

    // Статистика по типам файлов
    console.log('📋 Файлы по типам:');
    const sortedTypes = Object.entries(projectData.stats.filesByType)
        .sort((a, b) => b[1] - a[1]);

    for (const [type, count] of sortedTypes) {
        console.log(`   ${type.padEnd(15)} ${count}`);
    }

    console.log('\n🎉 Готово!');
}

// Запуск
if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        process.exit(1);
    }
}