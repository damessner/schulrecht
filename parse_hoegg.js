const fs = require('fs');

// Read the extracted text
const text = fs.readFileSync('hoegg_extracted.txt', 'utf-8');

// Remove page breaks and clean up
const cleanText = text
  .replace(/\n--- PAGE BREAK ---\n/g, '\n')
  .replace(/\s+/g, ' ')
  .replace(/(\d)\s+(\d)/g, '$1$2')
  .trim();

// Find all numbered questions (1. to 101.)
const questionRegex = /(\d+)\.\s{2,}([A-ZÄÖÜ][^?]+\?)/g;
const questions = [];
let match;

while ((match = questionRegex.exec(cleanText)) !== null) {
  const qNum = parseInt(match[1]);
  if (qNum >= 1 && qNum <= 101) {
    questions.push({
      number: qNum,
      question: match[2].replace(/\s+/g, ' ').trim()
    });
  }
}

console.log(`Found ${questions.length} questions from Hoegg`);
questions.forEach(q => {
  console.log(`  ${q.number}. ${q.question.substring(0, 80)}${q.question.length > 80 ? '...' : ''}`);
});
