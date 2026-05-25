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

// Role labels for practical responsibility questions
const ROLE_LABELS = {
  'Schulleiter': 'der Schulleitung',
  'Schulleitung': 'der Schulleitung',
  'Bundesminister': 'des zuständigen Bundesministers',
  'Schulbehörde': 'der Schulbehörde (Bildungsdirektion)',
  'Schulkonferenz': 'der Schulkonferenz',
  'Klassenkonferenz': 'der Klassenkonferenz',
  'Klassenvorstand': 'des Klassenvorstands',
  'Lehrer': 'der unterrichtenden Lehrkraft',
  'Schulforum': 'des Schulforums',
  'Schulgemeinschaftsausschuss': 'des Schulgemeinschaftsausschusses (SGA)',
  'Schulerhalter': 'des Schulerhalters',
  'Erziehungsberechtigten': 'der Erziehungsberechtigten (Eltern)',
  'Bildungsdirektion': 'der Bildungsdirektion',
  'Schüler': 'des Schülers / der Schülerin',
  'Prüfer': 'des Prüfers / der Prüferin',
};

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

// ─── BUILD OUTPUT ───

// ─── PRACTICAL SCENARIO GENERATOR ───
// Nur praxisnahe Fallbeispiele für Lehrer – keine abstrakten Paragraphenfragen.

function generateQuestions(para) {
  const questions = [];
  const text = para.text;
  const num = para.number;
  const title = para.title;
  if (!text || text.length < 30) return questions;

  // ─── FALL 1: Verbreitete Lehrer-Irrtümer (Richtig/Falsch) ───
  const praxisIrrtuemer = [
    'Eine Lehrerin darf eigenmächtig den Stundenplan ihrer Klasse ändern',
    'Schüler können bei schlechten Noten einfach die Schule wechseln',
    'Eltern haben immer das Recht, im Unterricht ihrer Kinder anwesend zu sein',
    'Eine Schule darf bei Regelverstößen Geldstrafen verhängen',
    'Der Klassenvorstand entscheidet allein über die Versetzung von Schülern',
    'Lehrer müssen alle Hausübungen am nächsten Tag benoten',
    'Schüler dürfen selbst entscheiden, ob sie am Förderunterricht teilnehmen',
    'Die Schulkonferenz tagt mindestens einmal pro Woche',
    'Ein Schulleiter kann jederzeit jede Klasse ohne Angabe von Gründen auflösen',
    'Lehrpersonen müssen während der Ferien in der Schule anwesend sein',
    'Schüler haben ein Recht auf Note 1, wenn sie sich bemühen',
    'Bei jeder Schularbeit muss mindestens die Hälfte der Klasse positiv sein',
    'Der Schulleiter wird von den Eltern und Schülern gemeinsam gewählt',
    'Noten dürfen nur nach Vorliegen aller Prüfungen bekannt gegeben werden',
    'Eine Schule kann einen Schüler jederzeit vom Unterricht ausschließen',
    'Schüler müssen bei jedem Fehlen eine ärztliche Bestätigung vorlegen',
    'Die Klasse darf selbst bestimmen, wann eine Schularbeit stattfindet',
    'Eltern können die Note ihres Kindes durch einen Antrag anfechten und ändern lassen',
    'Der Schulleiter muss jeder Stundenplanänderung persönlich zustimmen',
    'Ein Schüler darf maximal 3 Fehltage pro Semester haben',
    'Lehrer müssen den gesamten Lehrstoff bis zum Ende des Semesters durchnehmen',
    'Bei einer Klassenfahrt müssen alle Schüler teilnehmen – auch gegen ihren Willen',
    'Der Religionsunterricht ist für alle Schüler verpflichtend',
    'Die Schule darf Handys im Unterricht generell verbieten',
    'Nach der 9. Schulstufe besteht keine Schulpflicht mehr',
    'Die Schule darf den Schulbesuch verweigern, wenn das Kind keinen Wohnsitz in der Gemeinde hat',
    'Lehrpersonen dürfen eigenständig entscheiden, welche Unterrichtsmittel sie verwenden',
    'Ein Schüler kann ohne Zustimmung seiner Eltern die Schule wechseln',
    'Die Schulbehörde muss jede einzelne Note genehmigen',
    'Schüler haben das Recht, den Unterricht zu filmen',
  ];

  for (const irrtum of shuffle(praxisIrrtuemer)) {
    if (questions.length >= 2) break;
    const textLower = text.toLowerCase();
    const irrWords = irrtum.toLowerCase().split(' ').slice(0, 4);
    if (irrWords.some(w => textLower.includes(w))) {
      const isGenerallyFalse = true; // all listed are false/generalizations
      questions.push(makeQuestion(
        `„${irrtum}“ – stimmt das aus schulrechtlicher Sicht?`,
        '❌ Nein, das ist ein häufiger Irrtum',
        ['✅ Ja, das ist korrekt'],
        `Viele „Lehrerzimmer-Weisheiten“ sind rechtlich falsch! Das SchUG regelt das anders.`,
        `❌ Das stimmt nicht! Das SchUG enthält dazu spezifischere Regelungen. Solche pauschalen Aussagen sind meist unzulässig.`
      ));
    }
  }

  // ─── FALL 2: Wer ist zuständig? (praktische Situationen) ───
  // Formuliert als echte Frage aus dem Schulalltag
  const zustaendigkeiten = [
    { role: 'Schulleiter', q: 'Der Stundenplan muss geändert werden. Wer ordnet das an?', a: 'Der Schulleiter / die Schulleiterin', f: 'Der Klassenvorstand', f2: 'Die Schulbehörde', f3: 'Die Lehrperson selbst' },
    { role: 'Schulleiter', q: 'Eine Klasse muss neu eingeteilt werden. Wer entscheidet über die Klassenzuteilung?', a: 'Der Schulleiter / die Schulleiterin', f: 'Die Klassenkonferenz', f2: 'Die Bildungsdirektion', f3: 'Der Schulerhalter' },
    { role: 'Schulleiter', q: 'Ein Schüler möchte die Schule wechseln. Wer entscheidet über die Aufnahme?', a: 'Der Schulleiter / die Schulleiterin', f: 'Der Klassenvorstand', f2: 'Die Bildungsdirektion', f3: 'Der bisherige Klassenvorstand' },
    { role: 'Bundesminister', q: 'Die Richtlinien für die Leistungsbeurteilung sollen aktualisiert werden. Wer erlässt die Verordnung?', a: 'Der zuständige Bundesminister', f: 'Die Bildungsdirektion', f2: 'Der Schulleiter', f3: 'Die Schulkonferenz' },
    { role: 'Schulkonferenz', q: 'Ein Schüler mit sonderpädagogischem Förderbedarf soll nach einem abweichenden Lehrplan unterrichtet werden. Wer entscheidet?', a: 'Die Schulkonferenz', f: 'Der Schulleiter allein', f2: 'Die Eltern', f3: 'Der Klassenvorstand' },
    { role: 'Klassenkonferenz', q: 'Ein Schüler hat die Prüfung nicht bestanden – die Entscheidung über die Gesamtbeurteilung trifft:', a: 'Die Klassenkonferenz (unter Vorsitz des Schulleiters)', f: 'Der Klassenvorstand allein', f2: 'Die unterrichtende Lehrperson', f3: 'Der Schulleiter allein' },
    { role: 'Schulbehörde', q: 'Eine Privatschule möchte die Aufnahmebedingungen ändern. Wer genehmigt das?', a: 'Die zuständige Schulbehörde (Bildungsdirektion)', f: 'Der Schulleiter', f2: 'Der Schulerhalter', f3: 'Das Schulforum' },
    { role: 'Schulforum', q: 'Welche Lehrmittel angeschafft werden, entscheidet an öffentlichen Schulen:', a: 'Das Schulforum (bzw. die Schulkonferenz)', f: 'Der Schulleiter allein', f2: 'Die Bildungsdirektion', f3: 'Jede Lehrperson für sich' },
    { role: 'Klassenvorstand', q: 'Die Eltern möchten ein Gespräch über die Leistungen ihres Kindes. An wen wenden sie sich zuerst?', a: 'An den Klassenvorstand / die Klassenvorständin', f: 'An den Schulleiter', f2: 'An die Schulbehörde', f3: 'An den Schulerhalter' },
    { role: 'Erziehungsberechtigten', q: 'Ein Kind soll als außerordentlicher Schüler aufgenommen werden. Wer muss dafür sorgen, dass das Kind die Unterrichtssprache beherrscht?', a: 'Die Erziehungsberechtigten (Eltern)', f: 'Die Schule', f2: 'Der Klassenvorstand', f3: 'Die Bildungsdirektion' },
  ];

  for (const z of shuffle(zustaendigkeiten)) {
    if (questions.filter(q => q.type === 'zustaendigkeit').length >= 2) break;
    if (text.includes(z.role)) {
      questions.push(makeQuestion(z.q, z.a, [z.f, z.f2, z.f3],
        `Überlege, wer im Schulsystem für diese Aufgabe rechtlich zuständig ist.`,
        `Zuständig ist ${z.a}. (Quelle: § ${num} SchUG)`
      ));
    }
  }

  // ─── FALL 3: Fristen und Zahlen aus dem Schulalltag ───
  const detailMatches = text.match(/(\d+\s*(?:Tage|Monate|Wochen|Jahre|Schulstufe|Klasse|Semester|Stunden|Minuten))/g);
  if (detailMatches && detailMatches.length > 0) {
    const detail = detailMatches[Math.floor(Math.random() * detailMatches.length)];
    const wrongPool = ['3 Monate', '6 Wochen', '2 Jahre', '4 Semester', '8 Wochen', '12 Tage', '5 Werktage', '1 Monat', '2 Wochen', '10 Tage'];
    const wrong = shuffle(wrongPool.filter(d => d !== detail)).slice(0, 3);
    if (wrong.length === 3) {
      questions.push(makeQuestion(
        `Sie bereiten einen Antrag/eine Frist vor. Welche Zeitangabe nennt das Gesetz in diesem Zusammenhang?`,
        detail, wrong,
        `Fristen sind im Schulrecht oft entscheidend! Achte auf konkrete Zahlen.`,
        `Das Gesetz nennt hier „${detail}“. (Quelle: § ${num} SchUG)`
      ));
    }
  }

  // ─── FALL 4: Vertauschte Rollen im Schulalltag ───
  // Nimmt einen Satz aus dem Gesetz und tauscht eine Schlüsselrolle – 
  // aber nur wenn der Satz klar und vollständig ist.
  const swapPairs = [
    { from: 'Schulleiter', to: 'Klassenvorstand', label: 'Schulleiter' },
    { from: 'Schulleiterin', to: 'Klassenlehrerin', label: 'Schulleiter' },
    { from: 'Schulbehörde', to: 'Schulleiter', label: 'Schulbehörde' },
    { from: 'Bundesminister', to: 'Schulbehörde', label: 'Bundesminister' },
    { from: 'ordentlicher', to: 'außerordentlicher', label: 'ordentlicher Schüler' },
    { from: 'Schulkonferenz', to: 'Klassenkonferenz', label: 'Schulkonferenz' },
  ];

  for (const sp of shuffle(swapPairs)) {
    if (questions.filter(q => q.type === 'rollentausch').length >= 1) break;
    // Find a sentence that contains the keyword and is a reasonable length
    const sentences = text.split(/(?<=\.)\s+/).filter(s => 
      s.toLowerCase().includes(sp.label) && s.length > 30 && s.length < 200
    );
    if (sentences.length > 0) {
      const sentence = shuffle(sentences)[0]
        .replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
        .replace(/^[a-z]\)\s*/i, '').replace(/^\d+\.\s*/, '');
      if (sentence.length > 25) {
        const modified = sentence.replace(new RegExp(sp.from, 'i'), sp.to);
        const shortMod = modified.length > 120 ? modified.substring(0, 120) + '…' : modified;
        questions.push(makeQuestion(
          `Im Lehrerzimmer heißt es: „${shortMod}“ – stimmt diese Aussage?`,
          '❌ Nein, hier wurden die Rollen vertauscht',
          ['✅ Ja, das ist korrekt'],
          `Achtung: Hier wurden „${sp.from}“ und „${sp.to}“ verwechselt! Diese Rollen sind nicht austauschbar.`,
          `❌ Falsch! Im Gesetz steht „${sp.from}“, nicht „${sp.to}“. Die Rollen sind klar getrennt. (Quelle: § ${num})`
        ));
      }
    }
  }

  // ─── FALL 5: Konkrete Praxisfälle (Multiple Choice) ───
  const praxisFaelle = [
    { q: 'Ein Kind kommt aus einem Nicht-EU-Land nach Österreich und spricht kaum Deutsch. Wie wird es aufgenommen?', a: 'Als außerordentlicher Schüler mit Sprachförderung (§ 4)', f: 'Als ordentlicher Schüler ohne besondere Maßnahmen', f2: 'Es muss zuerst einen Deutschkurs außerhalb der Schule absolvieren', f3: 'Es wird zurückgestellt, bis es Deutsch kann', kw: ['außerordentlich', 'Sprachförderung', 'Deutsch', 'Unterrichtssprache'] },
    { q: 'Eine Schülerin möchte während des Schuljahres die Schule wechseln. Was gilt?', a: 'Der Schulleiter kann den Wechsel unter bestimmten Voraussetzungen genehmigen', f: 'Ein Schulwechsel ist nur am Ende des Schuljahres möglich', f2: 'Die Schülerin darf jederzeit ohne Genehmigung wechseln', f3: 'Nur die Bildungsdirektion kann einen Schulwechsel genehmigen', kw: ['Übertritt', 'Schule wechseln', 'Schulwechsel', 'Aufnahme'] },
    { q: 'Ein Schüler stört massiv den Unterricht. Welche Maßnahme ist rechtlich zulässig?', a: 'Der Schulleiter kann den Schüler vom Unterricht ausschließen (nach Anhörung der Klassenkonferenz, § 13)', f: 'Die Lehrkraft kann den Schüler sofort der Schule verweisen', f2: 'Die Klasse kann den Ausschluss per Mehrheitsbeschluss fordern', f3: 'Es dürfen nur pädagogische Maßnahmen gesetzt werden, ein Ausschluss ist nicht möglich', kw: ['ausgeschlossen', 'ausschließen', 'Ordnung', 'Verhalten', 'Schulveranstaltung'] },
    { q: 'Bei einer Schularbeit wird ein Schüler beim Schummeln erwischt. Welche Note bekommt er?', a: 'Die Leistung wird nicht beurteilt (§ 18 Abs. 4)', f: 'Note 5 (Nicht genügend)', f2: 'Note 4 (Genügend) – aber mit Vermerk', f3: 'Der Schüler darf die Arbeit sofort wiederholen', kw: ['vorgetäuschte', 'beurteilen', 'Leistungsbeurteilung', 'Nicht genügend'] },
    { q: 'Mehr als die Hälfte einer Klasse hat bei einer Schularbeit Note 5. Was passiert?', a: 'Die Arbeit wird mit neuer Aufgabenstellung einmal wiederholt', f: 'Die Noten bleiben, aber die Klasse bekommt Förderunterricht', f2: 'Der Lehrer muss die Arbeit milder beurteilen', f3: 'Die Arbeit wird annulliert und nicht gewertet', kw: ['Nicht genügend', 'Hälfte', 'wiederholen', 'neue Aufgabenstellung'] },
    { q: 'Ein Kind mit Behinderung kann bestimmte Leistungen nicht erbringen. Wie wird es beurteilt?', a: 'Nach dem erreichbaren Stand des Unterrichtserfolgs unter Bedachtnahme auf die Behinderung (§ 18 Abs. 6)', f: 'Nach dem gleichen Maßstab wie alle anderen Schüler', f2: 'Es wird automatisch positiv beurteilt', f3: 'Es wird von der Leistungsbeurteilung ausgenommen', kw: ['Behinderung', 'körperliche', 'sonderpädagogisch', 'Beurteilung'] },
    { q: 'Eine Lehrerin möchte mit der Klasse eine mehrtägige Schulveranstaltung (zB Projektwoche) durchführen. Welche Regeln gelten?', a: 'Die Schüler sind zur Teilnahme verpflichtet, außer bei Nächtigung außerhalb – dann braucht es Zustimmung der Eltern', f: 'Nur der Schulleiter entscheidet allein', f2: 'Die Bildungsdirektion muss jede Schulveranstaltung genehmigen', f3: 'Schulveranstaltungen sind immer freiwillig', kw: ['Schulveranstaltung', 'Nächtigung', 'Teilnahme', 'verpflichtet'] },
    { q: 'Ein Schüler wiederholt bereits die zweite Klasse derselben Schulstufe. Darf er noch einmal wiederholen?', a: 'Ein neuerliches Wiederholen derselben Schulstufe ist grundsätzlich nicht zulässig', f: 'Ja, mit Zustimmung der Eltern darf er beliebig oft wiederholen', f2: 'Ja, wenn die Schulkonferenz zustimmt', f3: 'Einmaliges Wiederholen ist immer möglich', kw: ['Wiederholen', 'Schulstufe', 'wiederholt', 'zweiten Mal'] },
    { q: 'Die Eltern sind mit der Note im Zeugnis nicht einverstanden. Welches Recht haben sie?', a: 'Sie können beim Schulleiter schriftlich Einspruch erheben (Berufungsrecht)', f: 'Sie haben kein Recht, Noten anzufechten', f2: 'Sie können direkt zur Bildungsdirektion gehen', f3: 'Sie können die Lehrperson zwingen, die Note zu ändern', kw: ['Berufung', 'Note', 'Zeugnis', 'Schulnachricht', 'Beurteilung'] },
    { q: 'Ein 14-jähriger Schüler möchte einen Freigegenstand besuchen, seine Eltern sind dagegen. Wer entscheidet?', a: 'Der Schüler kann sich selbst zur Teilnahme anmelden', f: 'Die Eltern entscheiden', f2: 'Der Schulleiter entscheidet', f3: 'Die Klassenkonferenz entscheidet', kw: ['Freigegenstand', 'Anmeldung', 'teilnehmen', 'Schüler'] },
    { q: 'Eine Lehrerin möchte Tablets im Unterricht einsetzen. Was muss sie beachten?', a: 'Digitale Endgeräte dürfen eingesetzt werden, wenn sie dem Lehrplan entsprechen und datenschutzkonform sind', f: 'Digitale Geräte sind im Unterricht grundsätzlich verboten', f2: 'Nur der Schulleiter kann den Einsatz digitaler Geräte erlauben', f3: 'Es dürfen nur Geräte der Schule verwendet werden', kw: ['digital', 'Endgerät', 'IKT', 'Tablet'] },
    { q: 'Ein Schüler möchte an einem Samstag eine Schularbeit nachschreiben. Darf er das?', a: 'Nein – an Samstagen, Sonn- und Feiertagen dürfen keine Hausübungen aufgegeben werden', f: 'Ja, wenn alle Beteiligten zustimmen', f2: 'Ja, am Samstag ist Unterricht möglich', f3: 'Ja, mit Genehmigung des Schulleiters', kw: ['Samstag', 'Sonntag', 'Feiertag', 'Hausübung'] },
    { q: 'Eine Schülerin ist krank am Tag der Schularbeit. Muss sie sofort ein ärztliches Attest vorlegen?', a: 'Nein – die Vorschriften über das Fernbleiben von der Schule (§ 45) regeln, wann ein Attest nötig ist', f: 'Ja, bei Schularbeiten immer', f2: 'Ja, innerhalb von 24 Stunden', f3: 'Nein, ein Attest ist nie erforderlich', kw: ['Fernbleiben', 'Attest', 'ärztlich', 'krank'] },
    { q: 'Ein Lehrer möchte Bildungsstandards-Tests durchführen. Dürfen die Ergebnisse benotet werden?', a: 'Nein – Kompetenzerhebungen fließen als Informationsfeststellungen nicht in die Leistungsbeurteilung ein', f: 'Ja, die Ergebnisse zählen wie Schularbeiten', f2: 'Ja, wenn der Lehrer das möchte', f3: 'Nur wenn die Schulkonferenz zustimmt', kw: ['Bildungsstandard', 'Kompetenzerhebung', 'Leistungsbeurteilung'] },
    { q: 'Ein Schulleiter möchte eine neue schulautonome Profilbildung einführen. Was ist zu beachten?', a: 'Die schulautonomen Reihungskriterien müssen für alle Bewerber in gleicher Weise gelten', f: 'Der Schulleiter kann das allein entscheiden', f2: 'Die Eltern müssen zustimmen', f3: 'Nur die Bildungsdirektion darf das festlegen', kw: ['schulautonom', 'Profilbildung', 'Reihungskriterien', 'Aufnahme'] },
    // Allgemeine Szenarien (passen zu vielen Paragraphen)
    { q: 'Eine Junglehrerin fragt sich: Für welche Schulen gilt das Schulunterrichtsgesetz (SchUG) eigentlich?', a: 'Für öffentliche und mit Öffentlichkeitsrecht ausgestattete Schulen der im Schulorganisationsgesetz geregelten Schularten', f: 'Nur für öffentliche Schulen', f2: 'Nur für Pflichtschulen', f3: 'Für alle Schulen in Österreich inklusive Privatschulen ohne Öffentlichkeitsrecht', kw: ['Geltungsbereich', 'Schulorganisationsgesetz', 'öffentlichen', 'öffentlich'] },
    { q: 'Im Lehrerzimmer diskutieren Kollegen: „Das SchUG gilt für alle Schulen in Österreich.“ Stimmt das?', a: 'Nein – es gilt nur für öffentliche und mit Öffentlichkeitsrecht ausgestattete Schulen bestimmter Schularten', f: 'Ja, für alle Schulen', f2: 'Ja, aber nur für Pflichtschulen', f3: 'Nein, es gilt nur für AHS und BMHS', kw: ['Geltungsbereich', 'gilt', 'Schularten'] },
    { q: 'Die Schulleitung fragt: „Ab wann zählt ein Schulcluster als eigene Schule?“ Was sagt das SchUG?', a: 'Bei Schulclustern ist unter Schulleiter der Leiter des Schulclusters zu verstehen', f: 'Jede Schule im Cluster ist eigenständig', f2: 'Ein Cluster ist keine rechtliche Einheit', f3: 'Der Cluster hat keinen eigenen Leiter', kw: ['Schulcluster', 'Cluster', 'Bereichsleiter'] },
    { q: 'Ein Kollege sagt: „Personenbezogene Bezeichnungen im Gesetz gelten nur in männlicher Form.“ Was sagt das SchUG?', a: 'Das stimmt nicht – § 2a stellt klar, dass sie auch in weiblicher Form gelten', f: 'Das stimmt – nur männlich', f2: 'Das Gesetz verwendet nur die weibliche Form', f3: 'Das Gesetz enthält dazu keine Regelung', kw: ['personenbezogene', 'weiblichen', 'Form', 'Bezeichnungen'] },
    { q: 'Ein Lehrer fragt: „Was ist eine abschließende Prüfung im Sinne des SchUG?“', a: 'Reifeprüfung, Reife- und Diplomprüfung, Diplomprüfung und Abschlussprüfung', f: 'Nur die Reifeprüfung (Matura)', f2: 'Nur die Abschlussprüfung an berufsbildenden Schulen', f3: 'Jede Prüfung, die ein Schuljahr abschließt', kw: ['abschließende', 'Prüfung', 'Reifeprüfung', 'Diplomprüfung'] },
    { q: 'Eine Direktorin möchte wissen: Fällt eine höhere land- und forstwirtschaftliche Lehranstalt auch unter das SchUG?', a: 'Ja – das SchUG gilt auch für diese Schulen (§ 1 Abs. 2)', f: 'Nein, dafür gibt es ein eigenes Gesetz', f2: 'Nur teilweise', f3: 'Nur wenn sie öffentlich ist', kw: ['land', 'forstwirtschaftlich', 'Lehranstalt', 'gilt'] },
    { q: 'Eine Lehrerin an einer Privatschule mit Öffentlichkeitsrecht: „Gilt das SchUG auch für mich?“', a: 'Ja – wenn die Privatschule mit Öffentlichkeitsrecht ausgestattet ist, gilt das SchUG', f: 'Nein, Privatschulen haben ihr eigenes Gesetz', f2: 'Nur die Bestimmungen über Prüfungen', f3: 'Nein, Privatschulen sind ausgenommen', kw: ['Privatschulen', 'Öffentlichkeitsrecht', 'gilt', 'Schularten'] },
    { q: 'Ein Schulleiter fragt: „Was ist die Aufgabe der österreichischen Schule, die das SchUG konkretisiert?“', a: 'Das SchUG regelt die innere Ordnung des Schulwesens als Grundlage des Zusammenwirkens von Lehrern, Schülern und Erziehungsberechtigten', f: 'Die Verwaltung der Schulen', f2: 'Die Festlegung der Lehrpläne', f3: 'Die Ausbildung der Lehrer', kw: ['Aufgabe', 'österreichischen', 'Schule', 'innere Ordnung', 'Zusammenwirken'] },
    { q: 'Ein Lehrer wird gefragt: „Wer ist im schulrechtlichen Sinn ein Lehrer?“', a: 'Lehrer sind auch Lehrbeauftragte, sofern nichts anderes angeordnet wird (§ 2b Abs. 2)', f: 'Nur vollzeitbeschäftigte Pädagogen mit Lehramtsstudium', f2: 'Nur Beamte im Schuldienst', f3: 'Jeder, der unterrichtet, auch wenn kein Lehramt', kw: ['Lehrer', 'Lehrbeauftragte', 'angeordnet', 'verstehen'] },
    { q: 'Eine Schülerin ist schwanger und möchte weiterhin die Schule besuchen. Gilt das SchUG hier?', a: 'Ja – das SchUG gilt für alle Schüler, unabhängig von persönlichen Umständen', f: 'Nein, Schwangerschaft ist ein Ausschlussgrund', f2: 'Die Schülerin muss die Schule wechseln', f3: 'Nur wenn sie gesundheitlich dazu in der Lage ist', kw: ['gilt', 'Schüler', 'Schule', 'öffentlichen'] },
    { q: 'Eine Lehrerin verwendet in ihrem Unterricht konsequent die weibliche Form (Schülerinnen). Ist das rechtlich korrekt?', a: 'Ja – personenbezogene Bezeichnungen gelten jeweils auch in ihrer weiblichen Form (§ 2a)', f: 'Nein, es muss die männliche Form verwendet werden', f2: 'Nur wenn die Schule das beschließt', f3: 'Das ist nicht geregelt', kw: ['personenbezogene', 'weiblichen', 'Form', 'Bezeichnungen'] },
    { q: 'Die Schulaufsicht fragt nach: „Dürfen wir in schriftlichen Dokumenten nur die männliche Form verwenden?“', a: 'Nein – das Gesetz stellt klar, dass beide Geschlechter gemeint sind', f: 'Ja, das ist üblich und rechtlich zulässig', f2: 'Nur in Gesetzestexten ist die weibliche Form erlaubt', f3: 'Das ist Sache der einzelnen Schule', kw: ['personenbezogene', 'weiblichen', 'männliche', 'Bezeichnungen'] },
    { q: 'Ein Schüler sagt: „Ich will nicht, dass meine Lehrerin mit ‚Schülerinnen und Schüler‘ angesprochen wird.“ Was sagt das Gesetz?', a: 'Das Gesetz sieht beide Formen als gleichwertig vor – die Verwendung ist zulässig', f: 'Der Schüler hat Recht, es muss die männliche Form verwendet werden', f2: 'Darüber entscheidet die Schulkonferenz', f3: 'Das Gesetz enthält dazu keine Aussage', kw: ['personenbezogene', 'Form', 'weiblichen', 'gilt'] },
    { q: 'Eine Lehrerin fragt: „Was ist eigentlich der Unterschied zwischen SchOG und SchUG?“', a: 'Das SchOG regelt die Schulorganisation (Schularten, Lehrpläne), das SchUG die innere Ordnung und den Unterrichtsbetrieb', f: 'Es gibt keinen Unterschied, es ist dasselbe Gesetz', f2: 'Das SchUG ist neuer und ersetzt das SchOG', f3: 'Das SchOG gilt nur für Pflichtschulen', kw: ['Schulorganisationsgesetzes', 'Aufgabe', 'innere Ordnung', 'Schule'] },
    { q: 'Eine Direktorin bereitet eine Schulveranstaltung vor und fragt: „Was genau regelt das SchUG eigentlich?“', a: 'Die innere Ordnung des Schulwesens als Grundlage des Zusammenwirkens von Lehrern, Schülern und Erziehungsberechtigten (§ 2)', f: 'Die Lehrpläne und Stundentafeln', f2: 'Die Besoldung der Lehrer', f3: 'Die Schulgebäudeverwaltung', kw: ['innere Ordnung', 'Schulwesens', 'Schule', 'Zusammenwirkens'] },
  ];

  for (const pf of shuffle(praxisFaelle)) {
    if (questions.filter(q => q.type === 'praxisfall').length >= 4) break;
    const textLower = text.toLowerCase();
    const matches = pf.kw.filter(kw => textLower.includes(kw.toLowerCase()));
    if (matches.length >= 2) { // at least 2 keywords must match
      questions.push(makeQuestion(pf.q, pf.a, [pf.f, pf.f2, pf.f3],
        `Stell dir vor, du stehst als Lehrkraft vor dieser Situation. Was sagt das SchUG dazu?`,
        `Gemäß § ${num} ist die richtige Antwort: „${pf.a}“.`
      ));
    }
  }

  return shuffle(questions).slice(0, 15);
}

// ─── BUILD OUTPUT ───

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
