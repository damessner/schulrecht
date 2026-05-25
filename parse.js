const fs = require('fs');
const path = require('path');

// ─── CATEGORY DEFINITIONS ───
// Merged to ensure each category has enough paragraphs for 30-45 questions
const CATEGORIES = [
  { id: 1,  title: 'Allgemeine Bestimmungen',                        paragraphs: ['1','2','2a','2b'] },
  { id: 2,  title: 'Aufnahme und Aufnahmsprüfungen',                 paragraphs: ['3','4','5','6','7','8'] },
  { id: 3,  title: 'Klassen, Stundenplan und Unterrichtsgegenstände', paragraphs: ['9','10','11','12','12a'] },
  { id: 4,  title: 'Schulveranstaltungen und Unterrichtsmittel',      paragraphs: ['13','13a','13b','14','14a','15','16'] },
  { id: 6,  title: 'Unterrichtsarbeit und Leistungsbeurteilung',      paragraphs: ['17','18','18a','18b'] },
  { id: 7,  title: 'Zeugnisse, Informationen, Verhalten',            paragraphs: ['19','19a','20','21','22','22a','22b','24'] },
  { id: 8,  title: 'Aufsteigen',                                     paragraphs: ['25','26','26a','27','28','29','30','30a'] },
  { id: 9,  title: 'Wiederholen, Prüfungen, Externisten',            paragraphs: ['23','23a','23b','31','31a','31b','31c','31e','32','33','34','35','36','36a','37','38','39','40','41','42'] },
  { id: 10, title: 'Schulordnung',                                   paragraphs: ['43','44','44a','45','46','47','48','49','50'] },
  { id: 11, title: 'Lehrerfunktionen und Konferenzen',               paragraphs: ['51','52','53','54','54a','55','55a','55b','55c','55d','55e','56','57'] },
  { id: 12, title: 'Schülerrechte und -pflichten',                   paragraphs: ['57a','57b','58','59','59a','59b'] },
  { id: 13, title: 'Schulpartnerschaft und Betreuung',                paragraphs: ['60','61','62','63','63a','64','64a','65','65a','66','66a','66b'] },
  { id: 14, title: 'Verfahrensbestimmungen',                         paragraphs: ['67','68','69','70','70a','71','72','72a','73','74','75','76','77','77a'] },
  { id: 15, title: 'Schluss- und Übergangsbestimmungen',             paragraphs: ['78','79','80','80a','81','82','82a','82b','82c','82d','82e','82f','82g','82h','82j','83'] },
];

// Build lookup: paragraph number → category id
const paraToCategory = {};
for (const cat of CATEGORIES) {
  for (const p of cat.paragraphs) {
    paraToCategory[p] = cat.id;
  }
}

// ─── HTML PARSER ───
const html = fs.readFileSync(
  path.join(__dirname, 'RIS - Schulunterrichtsgesetz - Bundesrecht konsolidiert, Fassung vom 25.05.2026.htm'),
  'utf-8'
);

const lines = html.split('\n');
const sections = [];
const allParagraphs = [];
let currentSection = null;
let currentParagraph = null;
let contentLines = [];

function pushParagraph() {
  if (currentParagraph) {
    currentParagraph.text = contentLines.join('\n').replace(/\s+/g, ' ').trim();
    if (currentSection) {
      currentSection.paragraphs.push(currentParagraph);
    }
    allParagraphs.push(currentParagraph);
    currentParagraph = null;
    contentLines = [];
  }
}

const skipPrefixes = [
  '* ', '<', 'http', 'Seitenbereiche', 'Navigationsleiste',
  'Rechtsinformationssystem', 'Druckansicht', 'Andere Formate',
  'PDF-Dokument', 'RTF-Dokument', 'CELEX', 'Umsetzungshinweis',
  'BGBl.', '§ 0', 'Langtitel', 'Änderung', 'Startseite',
  'Bund ', 'Länder', 'Bezirke', 'Gemeinden', 'Judikatur',
  'Kundmachungen', 'Gesamtabfrage', 'English', 'Zum Inhalt',
  'Zur Navigationsleiste', 'Kontakt', 'Impressum', 'Datenschutzerklärung',
  'Barrierefreiheitserklärung', 'Sitemap', 'Bundesrecht konsolidiert'
];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  if (!trimmed || skipPrefixes.some(p => trimmed.startsWith(p))) continue;

  // Section header
  const sectionMatch = trimmed.match(/^(\d+)\.\s*ABSCHNITT/);
  if (sectionMatch) {
    pushParagraph();
    currentSection = { number: parseInt(sectionMatch[1]), title: '', paragraphs: [] };
    sections.push(currentSection);
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const nt = lines[j].trim();
      if (nt && !nt.match(/^\d+\.\s*ABSCHNITT/) && !nt.startsWith('§') && nt === nt.toUpperCase() && nt.length > 5) {
        currentSection.title = nt;
        break;
      }
    }
    continue;
  }

  // Paragraph marker: "§ X.Paragraph X," or "§ X.Paragraph X a,"
  const paraMatch = trimmed.match(/^§\s*(\d+[a-z]*)\s*\.\s*Paragraph\s+\d+\s*[a-z]*\s*,/);
  if (paraMatch) {
    pushParagraph();
    currentParagraph = { number: paraMatch[1], title: '', text: '' };
    // Find topic - look backwards
    for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
      const pl = lines[j].trim();
      if (pl && pl.length > 2 && pl.length < 80 && !pl.match(/^\d+$/) && 
          pl !== 'Text' && !pl.match(/^Beachte/) && !pl.startsWith('§') &&
          !pl.startsWith('zum Bezugszeitraum') && pl !== pl.toUpperCase()) {
        const ppl = j > 0 ? lines[j-1].trim() : '';
        if (ppl === 'Text' || ppl.match(/^\d+$/) || ppl.startsWith('§') || ppl === '') {
          currentParagraph.title = pl;
          break;
        }
      }
    }
    continue;
  }

  // Fallback: lines starting with "§" followed by number then "Abs." or just number
  // Only if primary pattern didn't match
  if (!paraMatch) {
    const fallbackMatch = trimmed.match(/^§\s*(\d+[a-z]*)\.\s*(?:Abs\.|Paragraph)/);
    if (fallbackMatch) {
      pushParagraph();
      currentParagraph = { number: fallbackMatch[1], title: '', text: '' };
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const pl = lines[j].trim();
        if (pl && pl.length > 2 && pl.length < 80 && !pl.match(/^\d+$/) && 
            pl !== 'Text' && !pl.match(/^Beachte/) && !pl.startsWith('§') &&
            !pl.startsWith('zum Bezugszeitraum') && pl !== pl.toUpperCase()) {
          const ppl = j > 0 ? lines[j-1].trim() : '';
          if (ppl === 'Text' || ppl.match(/^\d+$/) || ppl.startsWith('§') || ppl === '') {
            currentParagraph.title = pl;
            break;
          }
        }
      }
      continue;
    }
  }

  // Content collection
  if (currentParagraph) {
    if (trimmed === 'Text' || trimmed.match(/^\d+$/) || trimmed.startsWith('(Anm.:') || 
        trimmed.startsWith('Anmerkung') || trimmed.startsWith('§')) continue;
    contentLines.push(trimmed);
  }
}
pushParagraph();

// ─── TEXT CLEANING ───
// The RIS format outputs each text block twice:
// 1. Abbreviated version (uses §, Abs., lit., BGBl. Nr., etc.)
// 2. Full-text version (uses Paragraph, Absatz, Litera, Bundesgesetzblatt Nr.)
// They're concatenated. We extract the full-text version by:
// - Removing text that follows the abbreviated pattern (uses §, BGBl. etc.)
// - Keeping text that uses full words (Paragraph, Absatz, etc.)
function extractFullText(text) {
  // Split on known transition markers where abbreviated text ends and full text begins
  // The full-text version always repeats with full words like "Paragraph", "Absatz", etc.
  // Strategy: remove segments that match the abbreviated style
  
  let result = text;
  
  // Remove patterns like "des § 5 aufzunehmen, wer" when followed immediately by full text
  // These are the abbreviated-style segments
  result = result
    // Remove abbreviated law references (e.g. "BGBl. Nr. 242/1962")
    .replace(/BGBl\.\s*(?:Nr\.\s*)?\d+[\d\/]*(?:\s*,[^)]*)?\)?/g, '')
    // Remove standalone "§ number" patterns (abbreviated paragraph refs)
    .replace(/\s*§\s*\d+[a-z]*(?:\s*Abs\.\s*\d+[a-z]*(?:\s*lit\.\s*[a-z]+)?)?/g, '')
    // Remove "Abs. number lit. letter" patterns
    .replace(/\s*Abs\.\s*\d+[a-z]*(?:\s*lit\.\s*[a-z]+)?/g, '')
    // Remove URL patterns with §
    .replace(/§\s*\d+[^,.\s]+/g, '')
    // Clean up double spaces and artifacts
    .replace(/\s+/g, ' ')
    .trim();
  
  // Now the text should primarily contain the full-text version
  // Further clean up - remove content before the first "Paragraph" if it's abbreviated
  const paraIdx = result.search(/(?:Paragraph|Absatz|Litera|Ziffer)/);
  if (paraIdx > 0) {
    const before = result.substring(0, paraIdx);
    // If the part before contains mostly numbers/symbols, remove it
    const symbolRatio = (before.match(/[§\d,;.]/g) || []).length / Math.max(before.length, 1);
    if (symbolRatio > 0.3 || before.length < 50) {
      result = result.substring(paraIdx);
    }
  }
  
  // Final cleanup
  result = result
    .replace(/^[,\s]+/, '')
    .replace(/([a-z])\.([A-Z])/g, '$1. $2') // Add space after period if missing
    .replace(/\s+/g, ' ')
    .trim();
  
  return result;
}

for (const p of allParagraphs) {
  const rawText = p.text;
  
  // First, try to identify and keep only the full-text version's lines
  const textLines = rawText.split('\n');
  const cleanLines = [];
  let inFullText = false;
  
  for (const l of textLines) {
    const trimmed = l.trim();
    if (!trimmed) continue;
    
    // Lines that contain full-text words are the ones we want
    const hasFullText = /Paragraph|Absatz|Litera|Ziffer|Bundesgesetzblatt|Bundesminister|Unterrichts/.test(trimmed);
    const hasAbbrev = /^§\s+\d+|BGBl\.|Abs\.\s+\d+|lit\.\s+[a-z]/.test(trimmed);
    
    if (hasFullText && !hasAbbrev) {
      cleanLines.push(trimmed);
      inFullText = true;
    } else if (inFullText && hasFullText) {
      cleanLines.push(trimmed);
    } else if (hasAbbrev) {
      inFullText = false;
    }
  }
  
  let cleanText = cleanLines.length > 3 
    ? cleanLines.join(' ') 
    : rawText;
  
  // Apply the smart extractor
  cleanText = extractFullText(cleanText);
  
  // If too short or empty, try alternative: keep second half of each sentence
  if (cleanText.length < 50) {
    // Split on sentence boundaries where the abbreviated version ends and full text begins
    // Pattern: abbreviated text ends with a comma/word and full text restarts
    cleanText = rawText
      .replace(/[^.]*?Paragraph/g, 'Paragraph') // Keep from first "Paragraph"
      .replace(/\s*§\s*\d+[^,.]*/g, '') // Remove § refs
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  p.text = cleanText
    .replace(/\s*,\s*\)/g, ')')
    .replace(/\(\s*,/g, '(')
    .replace(/ , /g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  // Mark empty paragraphs
  if (p.text.length < 20) {
    p.text = rawText.replace(/\s+/g, ' ').trim();
  }
}

// ─── QUESTION GENERATOR ───
// Generates multiple-choice questions with hints and explanations
// Targets 30-45 questions per category

const FAKE_ITEMS_POOL = [
  'Ein polizeiliches Führungszeugnis ist vorzulegen',
  'Die Zustimmung der Schulbehörde ist erforderlich',
  'Ein ärztliches Attest über die körperliche Eignung',
  'Der Nachweis der Deutschkenntnisse auf Maturaniveau',
  'Die Vorlage einer beglaubigten Geburtsurkunde',
  'Ein Empfehlungsschreiben des vorigen Lehrers',
  'Der Abschluss einer Haftpflichtversicherung ist nachzuweisen',
  'Die Mitgliedschaft im Elternverein ist verpflichtend',
  'Die Zahlung einer Einschreibegebühr ist erforderlich',
  'Ein psychologisches Gutachten muss vorgelegt werden',
  'Die Zustimmung der Schulkonferenz ist einzuholen',
  'Ein einjähriges Praktikum ist nachzuweisen',
  'Die Vorlage eines Lebenslaufs ist erforderlich',
  'Ein Bewerbungsgespräch ist zu absolvieren',
  'Die Schule darf die Aufnahmegebühr frei festlegen',
  'Der Schüler muss eine Aufnahmeprüfung in drei Fächern ablegen',
  'Die Schule kann Schüler nach eigenem Ermessen ablehnen',
  'Der Klassenvorstand entscheidet über die Aufnahme',
  'Die Eltern müssen der Aufnahme schriftlich zustimmen',
  'Der Religionsunterricht ist für alle Schüler verpflichtend',
];

const WRONG_SCOPE_OPTIONS = [
  'Die Organisation von Schulveranstaltungen',
  'Die Regelung von Prüfungsmodalitäten',
  'Bestimmungen zur Klassenbildung und Gruppeneinteilung',
  'Die Regelung der Ferien- und Urlaubsordnung',
  'Vorschriften zur Schulgebäudeverwaltung',
  'Die Festlegung von Lehrplänen und Stundentafeln',
  'Regelungen zur Lehrerbesoldung',
  'Bestimmungen über den Schultransport',
  'Die Organisation der Schulaufsicht',
  'Regelungen zur Schulbuchaktion',
  'Vorschriften über Schulpartnerschaft und Elternvereine',
  'Bestimmungen zur Schulverwaltung und Direktion',
  'Die Festlegung von Unterrichtszeiten',
  'Regelungen zur Nachmittagsbetreuung',
  'Die Organisation von Sprachförderkursen',
  'Bestimmungen zur Schülerhortbetreuung',
];

const ROLES = [
  { keyword: 'Schulleiter', label: 'Der Schulleiter / die Schulleiterin' },
  { keyword: 'Schulleitung', label: 'Die Schulleitung' },
  { keyword: 'Bundesminister', label: 'Der zuständige Bundesminister' },
  { keyword: 'Klassenvorstand', label: 'Der Klassenvorstand' },
  { keyword: 'Schulbehörde', label: 'Die zuständige Schulbehörde' },
  { keyword: 'Schulkonferenz', label: 'Die Schulkonferenz' },
  { keyword: 'Klassenkonferenz', label: 'Die Klassenkonferenz' },
  { keyword: 'Lehrer', label: 'Der/die unterrichtende Lehrer/in' },
  { keyword: 'Schulforum', label: 'Das Schulforum' },
  { keyword: 'Schulgemeinschaftsausschuss', label: 'Der Schulgemeinschaftsausschuss (SGA)' },
  { keyword: 'Schulerhalter', label: 'Der Schulerhalter' },
  { keyword: 'Bildungsdirektion', label: 'Die Bildungsdirektion' },
  { keyword: 'Erziehungsberechtigten', label: 'Die Erziehungsberechtigten' },
  { keyword: 'Schüler', label: 'Der Schüler / die Schülerin' },
  { keyword: 'Prüfer', label: 'Der Prüfer / die Prüferin' },
];

function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeQuestion(question, correctAnswer, wrongAnswers, hint, explanation, type = 'mc') {
  const options = shuffle([correctAnswer, ...wrongAnswers]);
  const correct = options.indexOf(correctAnswer);
  return { type, question, options, correct, hint, explanation };
}

function makeQuestionWithOpts(question, options, correctAnswer, hint, explanation, type = 'mc') {
  const shuffled = shuffle(options);
  const correct = shuffled.indexOf(correctAnswer);
  return { type, question, options: shuffled, correct, hint, explanation };
}

function extractSentence(text, keyword) {
  const sentences = text.split(/(?<=\.)\s+/);
  for (const sent of sentences) {
    if (sent.includes(keyword)) {
      return sent.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

function extractKeyPoints(t) {
  const points = [];
  // Match numbered items: "1. text" or "a) text" followed by number or letter
  const items = t.match(/(?:\d+\.\s*|[a-z]\)\s*)([A-Z][^0-9a-z)]*?)(?=(?:\d+\.|[a-z]\)|$))/g);
  if (items) {
    for (const item of items) {
      const clean = item.replace(/^\d+\.\s*/, '').replace(/^[a-z]\)\s*/, '').trim();
      if (clean.length > 15 && clean.length < 200 && !clean.match(/^(Abs|Ziffer|Litera|Paragraph)/)) {
        points.push(clean);
      }
    }
  }
  return points;
}

function generateQuestions(para) {
  const questions = [];
  const text = para.text;
  const num = para.number;
  const title = para.title;

  if (!text || text.length < 30) return questions;

  // Pre-extract data
  const points = extractKeyPoints(text);
  const sentences = text.split(/(?<=\.)\s+/).filter(s => s.trim().length > 20);
  
  // ─── TYPE 1: Content / Scope ───
  // "Was regelt §X?" - always generate
  if (title) {
    const wrongScope = shuffle(WRONG_SCOPE_OPTIONS.filter(o => o !== title)).slice(0, 3);
    questions.push(makeQuestion(
      `Was ist der Hauptgegenstand von § ${num}?`,
      title,
      wrongScope,
      `Der Titel des Paragraphen gibt einen direkten Hinweis auf den Regelungsgegenstand.`,
      `§ ${num} trägt den Titel "${title}" und regelt diesen Bereich.`
    ));
  }

  // ─── TYPE 2: Which paragraph number for this topic? ───
  if (title) {
    const correctOpt = `§ ${num}`;
    const wrongSet = new Set();
    const nums = [parseInt(num) + 1, Math.max(1, parseInt(num) - 1), parseInt(num) + 3, parseInt(num) - 2, parseInt(num) + 5];
    for (const n of nums) {
      const opt = `§ ${n}`;
      if (opt !== correctOpt) wrongSet.add(opt);
    }
    const wrongArr = [...wrongSet].slice(0, 3);
    if (wrongArr.length === 3) {
      questions.push(makeQuestion(
        `Welcher Paragraph regelt "${title}"?`,
        correctOpt, wrongArr,
        `Überlege, welcher Paragraphennummer das Thema "${title}" zugeordnet ist.`,
        `Das Thema "${title}" ist in § ${num} des Schulunterrichtsgesetzes geregelt.`
      ));
    }
  }

  // ─── TYPE 3: Role/Responsibility (up to 1 per paragraph) ───
  for (const role of ROLES) {
    if (questions.filter(q => q.type === 'responsibility').length >= 1) break;
    
    if (text.includes(role.keyword) && (text.includes('hat') || text.includes('obliegt') || text.includes('zuständig') || text.includes('zu'))) {
      const dutySentence = extractSentence(text, role.keyword);
      if (dutySentence && dutySentence.length < 250) {
        const otherRoles = shuffle(ROLES.filter(r => r.keyword !== role.keyword)).slice(0, 3).map(r => r.label);
        
        questions.push(makeQuestion(
          `Wer ist gemäß § ${num} wofür zuständig? ${dutySentence.substring(0, 80)}...`,
          role.label, otherRoles,
          `Im Gesetzestext ist eine bestimmte Person oder Institution als zuständig genannt.`,
          `Gemäß § ${num} ist ${role.label} zuständig. Textauszug: "${dutySentence.substring(0, 200)}."`
        ));
      }
    }
  }

  // ─── TYPE 4: Real vs Fake (condition/requirement) ───
  if (points.length >= 2) {
    const correct = points[Math.floor(Math.random() * points.length)];
    const wrong = shuffle(FAKE_ITEMS_POOL.filter(f => !text.includes(f))).slice(0, 3);
    questions.push(makeQuestion(
      `Welche der folgenden Regelungen ist in § ${num} tatsächlich enthalten?`,
      correct, wrong,
      `Nur eine der Aussagen stammt tatsächlich aus diesem Paragraphen.`,
      `§ ${num} enthält: "${correct.substring(0, 200)}". Die anderen Optionen sind nicht in diesem Paragraphen zu finden.`
    ));
  }

  // ─── TYPE 5: What is NOT in this paragraph ───
  if (points.length >= 3) {
    const real = shuffle(points).slice(0, 3);
    const fake = shuffle(FAKE_ITEMS_POOL.filter(f => !text.includes(f)))[0] || 'Eine Regelung die in diesem Paragraphen nicht vorkommt';
    const allOptions = [...real, fake];
    questions.push(makeQuestionWithOpts(
      `Welche Aussage ist KEIN Bestandteil von § ${num}?`,
      allOptions.map(o => o.length > 100 ? o.substring(0, 100) + '...' : o),
      fake.substring(0, 100),
      `Drei der Aussagen kommen im Paragraphen vor, eine ist erfunden.`,
      `"${fake.substring(0, 120)}" ist nicht in § ${num} enthalten. Die anderen Aussagen finden sich im Gesetzestext.`
    ));
  }

  // ─── TYPE 6: Obligation / Duty ───  
  const dutyPatterns = [
    /(hat|haben)\s+([^.]{20,150})/g,
    /(ist|sind)\s+([^.]{15,150}(?:verpflichtet|zulässig|vorgesehen|zu erlassen))/gi,
    /(obliegt)\s+([^.]{20,150})/g,
  ];
  
  for (const pat of dutyPatterns) {
    if (questions.filter(q => q.type === 'duty').length >= 1) break;
    const matches = [...text.matchAll(pat)];
    if (matches.length > 0) {
      const m = matches[Math.floor(Math.random() * matches.length)];
      const duty = m[0].replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      if (duty.length > 20 && duty.length < 200) {
        const fakeDuties = [
          'Jeder Lehrer darf den Unterricht nach eigenem Ermessen gestalten',
          'Schüler können den Unterricht jederzeit eigenmächtig verlassen',
          'Die Schule darf Schulveranstaltungen ohne Zustimmung absagen',
          'Der Klassenvorstand entscheidet allein über die Versetzung',
          'Noten können nach freiem Ermessen des Lehrers vergeben werden',
          'Die Schulbehörde muss jeder Änderung des Stundenplans zustimmen',
        ].filter(f => f !== duty.substring(0, 120));
        questions.push(makeQuestion(
          `Welche Verpflichtung oder Regelung ergibt sich aus § ${num}?`,
          duty.substring(0, 120), shuffle(fakeDuties).slice(0, 3),
          `Formulierungen wie "hat zu", "ist verpflichtet" oder "obliegt" weisen auf rechtliche Pflichten hin.`,
          `§ ${num} enthält folgende Regelung: "${duty.substring(0, 250)}."`
        ));
      }
    }
  }

  // ─── TYPE 7: True/False – multiple variants ───
  const validSentences = sentences.filter(s => s.length > 30 && s.length < 200);
  
  // TF1: Direct quote from the text → RICHTIG
  if (validSentences.length >= 1) {
    const realSnippet = shuffle(validSentences)[0].replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().substring(0, 120) + '...';
    questions.push(makeQuestion(
      `Richtig oder falsch? "${realSnippet}"`,
      '✅ Richtig',
      ['❌ Falsch'],
      `Überprüfe, ob diese Aussage wörtlich oder sinngemäß im Gesetzestext vorkommt.`,
      `✅ Diese Aussage ist RICHTIG – sie stammt (sinngemäß) aus § ${num}.`
    ));
  }
  
  // TF2: Take a real sentence and systematically modify a key piece → FALSCH
  const roleReplacements = [
    { from: 'Schulleiter', to: 'Klassenvorstand' },
    { from: 'Schulleiterin', to: 'Klassenlehrerin' },
    { from: 'Bundesminister', to: 'Schulbehörde' },
    { from: 'Schulbehörde', to: 'Schulleiter' },
    { from: 'Schulkonferenz', to: 'Klassenkonferenz' },
    { from: 'Klassenvorstand', to: 'Schulleiter' },
    { from: 'Schüler', to: 'Lehrer' },
    { from: 'Lehrer', to: 'Schüler' },
    { from: 'Erziehungsberechtigten', to: 'Schülern' },
    { from: 'ordentlicher', to: 'außerordentlicher' },
    { from: 'ordentlichen', to: 'außerordentlichen' },
    { from: 'außerordentlicher', to: 'ordentlicher' },
    { from: 'außerordentlichen', to: 'ordentlichen' },
    { from: 'zuständige', to: 'örtliche' },
    { from: 'zuständigen', to: 'örtlichen' },
  ];
  
  for (const rr of shuffle(roleReplacements)) {
    if (questions.filter(q => q.type === 'tf_modified').length >= 1) break;
    const match = text.match(new RegExp(rr.from, 'i'));
    if (match) {
      const idx = Math.max(0, match.index - 20);
      const snippet = text.substring(idx, idx + 150).replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      if (snippet.length > 30) {
        const modified = snippet.replace(new RegExp(rr.from, 'i'), rr.to);
        const truncated = modified.length > 130 ? modified.substring(0, 130) + '...' : modified;
        questions.push(makeQuestion(
          `Richtig oder falsch? "${truncated}"`,
          '❌ Falsch',
          ['✅ Richtig'],
          `Achte besonders auf die handelnden Personen/Rollen – wurde etwas vertauscht?`,
          `❌ Diese Aussage ist FALSCH. Im Gesetzestext steht hier "${rr.from}", nicht "${rr.to}".`
        ));
      }
    }
  }
  
  // TF3: Fabricated plausible-sounding rule → FALSCH
  const fakeRules = [
    'Die Schule kann bei Verstößen gegen die Schulordnung eine Geldstrafe verhängen',
    'Schüler haben das Recht, den Unterricht ab der 9. Schulstufe eigenständig abzuwählen',
    'Der Schulleiter wird von den Eltern der Schüler gewählt',
    'Noten können von Schülern durch eine zusätzliche Prüfung verbessert werden',
    'Jede Schule muss mindestens zwei Schulärzte beschäftigen',
    'Schüler dürfen maximal drei Fehltage pro Semester haben',
    'Die Schulaufsicht wird von den Eltern organisiert',
    'Lehrer müssen einmal jährlich eine Prüfung ablegen',
    'Schulen dürfen die Aufnahmegebühren frei festlegen',
    'Die Klassengröße darf maximal 35 Schüler betragen',
    'Der Klassenvorstand wird von den Schülern gewählt',
    'Eltern haben das Recht, den Unterricht ihrer Kinder jederzeit zu besuchen',
    'Schüler müssen eine uniforme Schulkleidung tragen',
    'Die Schulkonferenz tagt mindestens einmal pro Woche',
    'Jeder Lehrer darf die Noten nach eigenem Ermessen festlegen ohne Bindung an den Lehrplan',
    'Die Schule darf bei schlechten Leistungen eine Nachhilfegebühr verlangen',
    'Schüler müssen jedes Jahr eine Wiederholungsprüfung in Mathematik ablegen',
    'Der Schulerhalter ernennt die Lehrpersonen persönlich',
  ];
  
  for (const fake of shuffle(fakeRules)) {
    if (questions.filter(q => q.type === 'tf_fake').length >= 1) break;
    if (!text.toLowerCase().includes(fake.substring(0, 20).toLowerCase())) {
      questions.push(makeQuestion(
        `Richtig oder falsch? "${fake}"`,
        '❌ Falsch',
        ['✅ Richtig'],
        `Diese Regel klingt vielleicht plausibel, aber kommt sie tatsächlich in § ${num} vor?`,
        `❌ Diese Aussage ist FALSCH. Sie stammt nicht aus § ${num} und ist kein Bestandteil des Schulunterrichtsgesetzes.`
      ));
    }
  }
  
  // TF4: Negate a real rule → FALSCH
  if (validSentences.length >= 2) {
    const baseSent = validSentences.filter(s => 
      !s.includes('nicht') && !s.includes('kein') && s.length > 25 && s.length < 120
    );
    if (baseSent.length >= 1) {
      const sent = shuffle(baseSent)[0].replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().substring(0, 100);
      const negated = `Nicht ${sent.charAt(0).toLowerCase() + sent.slice(1)}`;
      if (negated.length < 130) {
        questions.push(makeQuestion(
          `Richtig oder falsch? "${negated}"`,
          '❌ Falsch',
          ['✅ Richtig'],
          `Wurde hier vielleicht eine Regelung ins Gegenteil verkehrt?`,
          `❌ Diese Aussage ist FALSCH. Die korrekte Regelung aus § ${num} lautet (sinngemäß): "${sent}..."`
        ));
      }
    }
  }

  // ─── TYPE 8: Specific detail ───
  const detailMatches = text.match(/(\d+\s*(?:Tage|Monate|Wochen|Jahre|Schulstufe|Klasse|Stufe|Semester))/g);
  if (detailMatches && detailMatches.length > 0) {
    const detail = detailMatches[Math.floor(Math.random() * detailMatches.length)];
    const wrongDetails = ['3 Monate', '6 Wochen', '2 Jahre', '4 Semester', '8 Wochen', '12 Tage']
      .filter(d => d !== detail).slice(0, 3);
    if (wrongDetails.length === 3) {
      questions.push(makeQuestion(
        `Welche Zeitangabe oder Mengenangabe kommt in § ${num} vor?`,
        detail, wrongDetails,
        `Achte auf konkrete Zahlen, Fristen oder Zeiträume im Gesetzestext.`,
        `In § ${num} wird "${detail}" als Frist oder Mengenangabe genannt.`
      ));
    }
  }

  // Extra pass for small paragraphs: generate additional simple questions
  if (questions.length < 8 && text.length > 50) {
    const keySents = text.split(/(?<=\.)\s+/).filter(s => s.length > 30 && s.length < 180);
    for (const sent of shuffle(keySents).slice(0, 3)) {
      const cleanSent = sent.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
      const words = cleanSent.split(' ');
      if (words.length > 5) {
        const hideIdx = Math.floor(words.length / 2);
        const hidden = words[hideIdx];
        const masked = words.map((w, i) => i === hideIdx ? '______' : w).join(' ');
        const fakeFill = shuffle([
          'Schulleiter', 'Bundesminister', 'Schulbehörde', 'Lehrer', 'Klassenvorstand',
          'Schüler', 'Erziehungsberechtigte', 'Schulkonferenz', 'Schulforum'
        ]).filter(w => w !== hidden).slice(0, 3);
        if (fakeFill.length === 3) {
          questions.push(makeQuestion(
            `Vervollständige: ${masked.substring(0, 120)}`,
            hidden, fakeFill,
            'Ergänze das fehlende Wort sinnvoll aus dem Kontext.',
            `Das fehlende Wort ist "${hidden}". Der vollständige Satz: "${cleanSent.substring(0, 200)}."`
          ));
        }
      }
    }
  }
  
  // Return up to 15 questions per paragraph
  return shuffle(questions).slice(0, 15);
  // Goal: categories with 3+ paragraphs get ~30-60 questions ✓
}

// ─── BUILD OUTPUT ───
// ─── CATEGORY-LEVEL QUESTIONS ───
function generateCategoryQuestions(catTitle, paragraphs) {
  const questions = [];
  const paras = paragraphs.filter(p => p.title && p.text.length > 30);
  
  if (paras.length < 2) return questions;
  
  // Question type: Match paragraph number to topic
  if (paras.length >= 2) {
    for (let i = 0; i < Math.min(3, paras.length); i++) {
      const correctPara = paras[i];
      const wrongParas = shuffle(paras.filter(p => p.number !== correctPara.number)).slice(0, 3);
      while (wrongParas.length < 3) {
        wrongParas.push({ number: '99', title: 'Nicht im Gesetz' });
      }
      questions.push(makeQuestion(
        `Welcher Paragraph innerhalb der Kategorie "${catTitle}" regelt "${correctPara.title}"?`,
        `§ ${correctPara.number}`,
        wrongParas.map(p => `§ ${p.number}`),
        `Überlege, welche Paragraphennummer zum Thema "${correctPara.title}" gehört.`,
        `"${correctPara.title}" ist in § ${correctPara.number} geregelt.`
      ));
    }
  }
  
  // Question type: Which paragraph belongs to which category
  const sampleParas = shuffle(paras).slice(0, 3);
  for (const p of sampleParas) {
    const otherCats = shuffle(CATEGORIES.filter(c => c.title !== catTitle)).slice(0, 3);
    questions.push(makeQuestion(
      `In welcher Kategorie findest du § ${p.number} ("${p.title}")?`,
      catTitle,
      otherCats.map(c => c.title),
      `§ ${p.number} passt thematisch zu einer bestimmten Kategorie.`,
      `§ ${p.number} ("${p.title}") gehört zur Kategorie "${catTitle}".`
    ));
  }
  
  // Question type: What does NOT belong to this category
  const otherCatParas = [];
  for (const c of CATEGORIES) {
    if (c.title !== catTitle && c.paragraphs.length > 0) {
      const idx = parseInt(c.paragraphs[Math.floor(Math.random() * c.paragraphs.length)]);
      const p = allParagraphs.find(p => p.number === String(idx));
      if (p && p.title) otherCatParas.push(p);
    }
  }
  const realParas = shuffle(paras).slice(0, 3);
  const fakePara = shuffle(otherCatParas)[0];
  if (realParas.length >= 3 && fakePara) {
    const fakeOpt = `§ ${fakePara.number}: ${fakePara.title}`;
    questions.push(makeQuestionWithOpts(
      `Welcher Paragraph gehört NICHT zur Kategorie "${catTitle}"?`,
      [...realParas.map(p => `§ ${p.number}: ${p.title}`), fakeOpt],
      fakeOpt,
      `Drei Paragraphen gehören zur genannten Kategorie, einer nicht.`,
      `§ ${fakePara.number} ("${fakePara.title}") gehört nicht zur Kategorie "${catTitle}", sondern zu einer anderen.`
    ));
  }
  
  return questions;
}

const categoryMap = {};
for (const cat of CATEGORIES) {
  categoryMap[cat.id] = { ...cat, paragraphs: [] };
}

for (const p of allParagraphs) {
  const catId = paraToCategory[p.number];
  if (catId) {
    p.questions = generateQuestions(p);
    categoryMap[catId].paragraphs.push(p);
  }
}

// Add category-level questions
for (const cat of CATEGORIES) {
  const catData = categoryMap[cat.id];
  const paras = catData.paragraphs;
  const catQuestions = generateCategoryQuestions(cat.title, paras);
  // Shuffle cat questions and add a few
  const shuffled = shuffle(catQuestions);
  for (let i = 0; i < Math.min(15, shuffled.length); i++) {
    // Add to a random paragraph or just to the category
    if (paras.length > 0) {
      paras[i % paras.length].questions.push(shuffled[i]);
    }
  }
}

const output = {
  generated: new Date().toISOString(),
  source: 'Schulunterrichtsgesetz (SchUG), BGBl. Nr. 472/1986',
  version: 'Konsolidierte Fassung vom 25.05.2026',
  categories: Object.values(categoryMap).sort((a, b) => a.id - b.id)
};

// Stats
let totalQ = 0;
for (const cat of output.categories) {
  for (const p of cat.paragraphs) {
    totalQ += p.questions.length;
  }
}
console.log(`Categories: ${output.categories.length}`);
console.log(`Total paragraphs: ${allParagraphs.length}`);
console.log(`Total questions generated: ${totalQ}`);
for (const cat of output.categories) {
  console.log(`  ${cat.id}. ${cat.title}: ${cat.paragraphs.length} §§, ${cat.paragraphs.reduce((s,p) => s + p.questions.length, 0)} questions`);
}

fs.writeFileSync(
  path.join(__dirname, 'schug-data.json'),
  JSON.stringify(output, null, 2),
  'utf-8'
);
console.log('\n✅ schug-data.json written');
