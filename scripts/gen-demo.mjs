// Writes the demo dataset (data/demo/*.csv) and blank templates (templates/*.csv).
import { writeFileSync, mkdirSync } from 'node:fs';
import { demoFiles, templateFiles, DEMO_FILE_NAMES } from '../src/demo/generator.js';

mkdirSync('data/demo', { recursive: true });
mkdirSync('templates', { recursive: true });
for (const [id, text] of Object.entries(demoFiles())) writeFileSync(`data/demo/${DEMO_FILE_NAMES[id]}`, text);
for (const [id, text] of Object.entries(templateFiles())) writeFileSync(`templates/${DEMO_FILE_NAMES[id]}`, text);
console.log('Wrote data/demo/ and templates/');
