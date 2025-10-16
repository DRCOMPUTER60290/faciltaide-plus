const fs = require('fs');
const path = require('path');

const bundleDir = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'metro-runtime',
  'build',
  'bundle'
);

const bytecodeFile = path.join(bundleDir, 'InternalBytecode.js');
const projectFallbackFile = path.join(__dirname, '..', 'InternalBytecode.js');

try {
  if (!fs.existsSync(bundleDir)) {
    fs.mkdirSync(bundleDir, { recursive: true });
  }

  if (!fs.existsSync(bytecodeFile)) {
    const banner = `// Auto-generated fallback to avoid ENOENT when Metro inspects Hermes internal frames.\n`;
    const body = [
      banner,
      '"use strict";',
      '',
      '// Metro may try to read this helper when formatting stack traces for Hermes bytecode.',
      '// The published @expo/metro-runtime package does not always ship the prebuilt file,',
      '// which leads to ENOENT errors on Windows machines.  Creating an empty module is',
      '// sufficient because the file is only read for introspection.',
      '',
      'module.exports = {};',
      '',
    ].join('\n');

    fs.writeFileSync(bytecodeFile, body, 'utf8');
  }

  if (!fs.existsSync(projectFallbackFile)) {
    const fallbackBanner =
      '// Auto-generated fallback placed at the project root for Metro on Windows.\n';
    const fallbackContents = [fallbackBanner, 'module.exports = {};', ''].join('\n');
    fs.writeFileSync(projectFallbackFile, fallbackContents, 'utf8');
  }
} catch (error) {
  console.warn('[ensure-metro-bytecode] Unable to create Hermes bytecode stub:', error);
}
