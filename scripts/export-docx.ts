import fs from 'fs';
import path from 'path';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

function mdToDocxParagraphs(md: string): Paragraph[] {
  const lines = md.split(/\r?\n/);
  const paras: Paragraph[] = [];

  for (const line of lines) {
    if (line.startsWith('### ')) {
      paras.push(new Paragraph({ text: line.replace(/^###\s+/, ''), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('## ')) {
      paras.push(new Paragraph({ text: line.replace(/^##\s+/, ''), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('# ')) {
      paras.push(new Paragraph({ text: line.replace(/^#\s+/, ''), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('- ')) {
      paras.push(new Paragraph({ text: line.replace(/^-\s+/, ''), bullet: { level: 0 } }));
    } else if (line.trim() === '---') {
      paras.push(new Paragraph({}));
    } else if (line.trim() === '') {
      paras.push(new Paragraph({}));
    } else {
      paras.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }

  return paras;
}

async function main() {
  const input = process.argv[2];
  const output = process.argv[3];
  if (!input || !output) {
    console.error('Usage: ts-node scripts/export-docx.ts <input.md> <output.docx>');
    process.exit(1);
  }
  const mdPath = path.resolve(input);
  const outPath = path.resolve(output);
  const md = fs.readFileSync(mdPath, 'utf8');

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: mdToDocxParagraphs(md),
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  console.log(`Wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



