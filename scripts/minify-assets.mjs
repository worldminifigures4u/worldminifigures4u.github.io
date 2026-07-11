import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { minify as minifyJs } from 'terser';
import CleanCSS from 'clean-css';

async function listFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await listFiles(fullPath));
            continue;
        }
        files.push(fullPath);
    }

    return files;
}

async function minifyFile(file) {
    const ext = extname(file).toLowerCase();
    const source = await readFile(file, 'utf8');

    if (ext === '.js') {
        const result = await minifyJs(source, {
            compress: true,
            mangle: true,
            format: { comments: false }
        });
        if (result.error) throw result.error;
        await writeFile(file, result.code);
        return 'js';
    }

    if (ext === '.css') {
        const result = new CleanCSS({ level: 2 }).minify(source);
        if (result.errors.length) {
            throw new Error(result.errors.join('\n'));
        }
        await writeFile(file, result.styles);
        return 'css';
    }

    return null;
}

const targetDir = process.argv[2] || '_site';
const files = await listFiles(targetDir);
let jsCount = 0;
let cssCount = 0;

for (const file of files) {
    const kind = await minifyFile(file);
    if (kind === 'js') jsCount += 1;
    if (kind === 'css') cssCount += 1;
}

console.log(`Minified ${jsCount} JS and ${cssCount} CSS files in ${targetDir}`);
