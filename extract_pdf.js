const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfPath = 'Die 100 haufigsten Fragen zum S - Hoegg.pdf';

const pdfParser = new PDFParser();
pdfParser.on('pdfParser_dataReady', (pdfData) => {
  let text = '';
  for (const page of pdfData.Pages) {
    for (const textItem of page.Texts) {
      const decoded = decodeURIComponent(textItem.R[0].T);
      text += decoded + ' ';
    }
    text += '\n--- PAGE BREAK ---\n';
  }
  fs.writeFileSync('hoegg_extracted.txt', text, 'utf-8');
  console.log('Pages:', pdfData.Pages.length);
  console.log('Text length:', text.length);
  console.log('First 800 chars:\n', text.substring(0, 800));
});

pdfParser.on('pdfParser_dataError', (err) => console.error('Error:', err));

pdfParser.loadPDF(pdfPath);
