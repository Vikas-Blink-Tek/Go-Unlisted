const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const baseDir = path.resolve(__dirname, '..');
const files = [
  'Privacy_Policy_Go_Unlisted.docx',
  'Terms_and_Conditions_Go_Unlisted.docx',  
  'Disclaimer_Go_Unlisted.docx',
  'Risk_Disclosure_Go_Unlisted.docx'
];

// docx files are zip files. Use unzip command to extract xml
for (const f of files) {
  const fp = path.join(baseDir, f);
  console.log('FILE:', f);
  try {
    const xml = execSync('unzip -p "' + fp + '" word/document.xml', { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    // Extract text between <w:t> tags which is where Word stores text
    const matches = [];
    const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = regex.exec(xml)) !== null) {
      matches.push(m[1]);
    }
    // Also detect paragraph breaks
    const paragraphs = xml.split(/<\/w:p>/);
    const result = [];
    for (const p of paragraphs) {
      const texts = [];
      const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tm;
      while ((tm = tRegex.exec(p)) !== null) {
        texts.push(tm[1]);
      }
      if (texts.length > 0) {
        result.push(texts.join(''));
      }
    }
    console.log(result.join('\n'));
  } catch (e) {
    console.log('ERROR:', e.message);
  }
  console.log('---END---');
  console.log();
}
