// scripts/listFiles.js
// Usage: node listFiles.js <directory>
// Outputs a JSON array of all files (recursively) in the directory, excluding certain folders.

const fs = require('fs');
const path = require('path');

const excludeDirs = ['.strapi', '.tmp', 'dist', 'node_modules', '.git'];

function walk(dir, root) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        const relPath = path.relative(root, filePath);
        if (fs.statSync(filePath).isDirectory()) {
            if (!excludeDirs.includes(file)) {
                results = results.concat(walk(filePath, root));
            }
        } else {
            results.push(relPath.replace(/\\/g, '/'));
        }
    });
    return results;
}

const dir = process.argv[2];
if (!dir) {
    console.error('Usage: node listFiles.js <directory>');
    process.exit(1);
}
process.stdout.write(JSON.stringify(walk(dir, dir)));
