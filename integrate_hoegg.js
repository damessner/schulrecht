const fs = require('fs');

// Read and clean text
const rawText = fs.readFileSync('hoegg_extracted.txt', 'utf-8');
const text = rawText
  .replace(/\n--- PAGE BREAK ---\n/g, '\n')
  .replace(/\s+/g, ' ')
  .replace(/\s{2,}/g, ' ')
  .replace(/(\d)\s+(\d)/g, '$1$2')
  .trim();

// Find all question boundaries
const qStartRegex = /(\d{1,3})\.\s{1,3}([A-ZÄÖÜ][^?]+\?)/g;
const boundaries = [];
let m;
while ((m = qStartRegex.exec(text)) !== null) {
  const num = parseInt(m[1]);
  if (num >= 1 && num <= 101) {
    boundaries.push({ number: num, question: m[2].trim().replace(/\s+/g, ' '), start: m.index, end: m.index + m[0].length, sectionStart: m.index });
  }
}

// Sort and dedupe by number
const seen = new Set();
const questions = [];
for (const b of boundaries.sort((a, b) => a.number - b.number)) {
  if (!seen.has(b.number)) {
    seen.add(b.number);
    questions.push(b);
  }
}

// Add answer context
for (let i = 0; i < questions.length; i++) {
  const nextQ = questions[i + 1];
  const endPos = nextQ ? nextQ.sectionStart : Math.min(questions[i].start + 8000, text.length);
  questions[i].answer = text.substring(questions[i].end, endPos).replace(/\s+/g, ' ').trim();
}

console.log(`Extracted ${questions.length} Hoegg questions`);

// ─── QUESTION GENERATOR ───
function shuffle(a) {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function createMC(q, right, wrong, hint, expl) {
  const options = shuffle([right, ...wrong]);
  return { question: q, options, correct: options.indexOf(right), hint, explanation: expl };
}

function createTF(stmt, isTrue, hint, expl) {
  const options = shuffle([isTrue ? '✅ Richtig' : '❌ Falsch', isTrue ? '❌ Falsch' : '✅ Richtig']);
  return { question: stmt, options, correct: options.indexOf(isTrue ? '✅ Richtig' : '❌ Falsch'), hint, explanation: expl };
}

// Generate quiz questions from each Hoegg QA pair
const allMC = [];

for (const hq of questions) {
  const a = hq.answer;
  const q = hq.question;
  if (a.length < 100) continue;
  
  const qs = [];
  
  // 1. DIRECT ANSWER: What is the answer?
  const firstSentences = a.substring(0, 300);
  let directAnswer = '';
  let directWrong = [];
  
  if (firstSentences.match(/nein\b/i) && !firstSentences.match(/ja\b/i)) {
    directAnswer = 'Grundsätzlich nein – aber es gibt Ausnahmen und Einschränkungen';
    directWrong = ['Ja, das ist immer erlaubt', 'Das Gesetz sagt dazu nichts', 'Die Schulbehörde muss zustimmen'];
  } else if (firstSentences.match(/\b(ja|natürlich|selbstverständlich)\b/i)) {
    directAnswer = 'Grundsätzlich ja – aber mit bestimmten Voraussetzungen und Grenzen';
    directWrong = ['Nein, das ist grundsätzlich verboten', 'Nur mit Genehmigung der Schulbehörde', 'Das entscheidet jede Schule selbst'];
  } else {
    directAnswer = 'Das hängt vom Einzelfall ab und ist differenziert zu betrachten';
    directWrong = ['Ja, das ist immer zulässig', 'Nein, das ist nie erlaubt', 'Darüber entscheidet ausschließlich der Schulleiter'];
  }
  
  qs.push(createMC(
    q,
    directAnswer, directWrong,
    'Günther Hoegg beantwortet diese praxisnahe Frage in seinem Buch differenziert.',
    `Die Antwort auf diese Frage ist nicht einfach ja/nein. Aus dem Kontext: "${firstSentences.substring(0, 200)}"`
  ));
  
  // 2. KEY PRINCIPLE: Extract a key legal takeaway
  const keyPatterns = [
    { regex: /(?:Zunachst|Grundsatzlich|Allerdings|Deshalb|Daher|Folglich|Fazit|Das bedeutet|Also)\s+([^.]{40,200}\.)/gi, prefix: '' },
    { regex: /(?:Nein[,.])?\s*([^.]*?(?:darf|durfen|konnen|mussen|nicht|kein|keine|immer|grundsatzlich|jederzeit|niemals)[^.]{30,150}\.)/gi, prefix: '' },
    { regex: /(?:gilt|geltend|maßgebend|entscheidend)[^.]*?([^.]{40,200}\.)/gi, prefix: 'Es gilt: ' },
  ];
  
  for (const kp of keyPatterns) {
    if (qs.length >= 4) break;
    const matches = [...a.matchAll(kp.regex)];
    for (const match of matches.slice(0, 2)) {
      const principle = (kp.prefix + match[1].trim()).substring(0, 150);
      if (principle.length > 40) {
        const isTrue = !principle.match(/nicht|kein|keine|falsch/i);
        qs.push(createTF(
          `Laut Hoegg: „${principle}“`,
          isTrue,
          'Günther Hoegg analysiert diese Frage aus schulrechtlicher und praktischer Perspektive.',
          principle.substring(0, 200)
        ));
      }
    }
  }
  
  // 3. FREQUENT MISCONCEPTION: Common teacher misconceptions
  const misconceptionPatterns = [
    /(?:viele|meiste|einige|etliche)\s+(?:Kollegen|Lehrkrafte|Lehrer)\s+(?:meinen|glauben|denken|gehen davon aus)[^.]*?([^.]{30,180}\.)/gi,
    /(?:haufig|oft|regelmassig)\s+(?:wird|werden)\s+(?:falschlich|irrtumlich)[^.]*?([^.]{30,180}\.)/gi,
    /(?:Das ist|Dies ist|Das ware)\s+(?:falsch|ein Irrtum|nicht richtig)[^.]*?([^.]{30,180}\.)/gi,
  ];
  
  for (const mp of misconceptionPatterns) {
    if (qs.length >= 6) break;
    const matches = [...a.matchAll(mp.regex)];
    for (const match of matches.slice(0, 1)) {
      const misconception = match[1].trim().substring(0, 140);
      if (misconception.length > 30) {
        qs.push(createTF(
          `Häufiger Irrtum unter Lehrkräften: „${misconception}“`,
          false,
          'Viele Lehrkräfte haben falsche Vorstellungen – Hoegg klärt auf.',
          `Das ist ein verbreiteter Irrtum. Die richtige Rechtslage: ${misconception.substring(0, 150)}`
        ));
      }
    }
  }
  
  // 4. PRACTICAL ADVICE: What should a teacher DO?
  const advicePatterns = [
    /(?:mein (?:Tipp|Rat|Vorschlag)|ich empfehle|empfehlenswert)[^.]*?([^.]{40,200}\.)/gi,
    /(?:sollten Sie|mussen Sie|durfen Sie|konnen Sie)[^.]*?([^.]{30,150}\.)/gi,
  ];
  
  for (const ap of advicePatterns) {
    if (qs.length >= 8) break;
    const matches = [...a.matchAll(ap.regex)];
    for (const match of matches.slice(0, 2)) {
      const advice = match[1].trim();
      if (advice.length > 30 && advice.length < 180) {
        const fakeAdvice = shuffle([
          'Sie sollten die Angelegenheit sofort der Schulbehörde melden',
          'Am besten ignorieren Sie die Situation und warten ab',
          'Wenden Sie sich direkt an den zuständigen Bundesminister',
          'Lassen Sie die Klasse darüber abstimmen',
        ]);
        qs.push(createMC(
          `Was rät Schulrechtsexperte Hoegg in dieser Situation?`,
          advice.substring(0, 120),
          fakeAdvice.filter(f => f !== advice.substring(0, 120)).slice(0, 3),
          'Hoegg gibt in seinem Buch konkrete Handlungsempfehlungen für Lehrkräfte.',
          advice.substring(0, 250)
        ));
      }
    }
  }
  
  // 5. EXCEPTION CLAUSE: When does the rule NOT apply?
  const exceptionPatterns = [
    /(?:Allerdings|Aber|Jedoch|Ausnahme|außer|es sei denn|abweichend)[^.]*?([^.]{30,180}\.)/gi,
  ];
  
  for (const ep of exceptionPatterns) {
    if (qs.length >= 10) break;
    const matches = [...a.matchAll(ep.regex)];
    for (const match of matches.slice(0, 1)) {
      const exception = match[1].trim();
      if (exception.length > 30 && exception.length < 160) {
        qs.push(createTF(
          `Es gibt eine wichtige Ausnahme: „${exception}“`,
          true,
          'Fast jede schulrechtliche Regel hat Ausnahmen – achte darauf!',
          `Diese Ausnahme ist korrekt: ${exception.substring(0, 200)}`
        ));
      }
    }
  }
  
  // 6. LEGAL REFERENCE: Court ruling or law reference
  const legalRefs = a.match(/(?:OVG|VGH|BVerwG|BGH|BV erfG|§\s*\d+[a-z]*\s+(?:Abs\.|SchUG|StGB|GG))/gi);
  if (legalRefs && legalRefs.length > 0) {
    const ref = legalRefs[Math.floor(Math.random() * legalRefs.length)];
    qs.push(createMC(
      `Welche rechtliche Grundlage wird in Hoeggs Antwort auf „${hq.question.substring(0, 60)}...“ zitiert?`,
      ref,
      shuffle(['§ 1 SchUG', 'Art. 1 GG', '§ 823 BGB', 'EMRK']).filter(f => f !== ref).slice(0, 3),
      'Hoegg zitiert in seinen Antworten konkrete Rechtsgrundlagen und Gerichtsurteile.',
      `Hoegg verweist unter anderem auf ${ref}.`
    ));
  }
  
  // Shuffle and take up to 10 per question
  const selected = shuffle(qs).slice(0, 10);
  allMC.push(...selected);
}

console.log(`Generated ${allMC.length} quiz questions total`);

// Add as new category to JSON
const data = JSON.parse(fs.readFileSync('schug-data.json', 'utf-8'));

data.categories.push({
  id: 20,
  title: 'Praxiswissen nach Hoegg (100 Fragen)',
  paragraphs: [{
    number: 'Hoegg',
    title: 'Die 100 häufigsten Fragen zum Schulrecht (Günther Hoegg, Beltz 2019)',
    text: `Diese Kategorie enthält praxisnahe Quizfragen basierend auf dem Buch "Die 100 häufigsten Fragen zum Schulrecht" von Dr. Günther Hoegg (Jurist und Lehrer). Die Fragen wurden aus den Antworten des Autors extrahiert.`,
    questions: allMC
  }]
});

fs.writeFileSync('schug-data.json', JSON.stringify(data, null, 2), 'utf-8');
console.log(`Total questions in Hoegg category: ${allMC.length}`);
console.log(`JSON updated with ${data.categories.length} categories`);
