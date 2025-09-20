// ---- Prompt API hello world ----
export async function testPromptAPI() {
  if (!('LanguageModel' in self)) {
    throw new Error('Prompt API not available. Use Chrome Canary with flags enabled.');
  }
  const availability = await LanguageModel.availability();
  if (availability === 'unavailable') throw new Error('Gemini Nano unavailable on this device.');
  const session = await LanguageModel.create({
    monitor(m) {
      m.addEventListener('downloadprogress', e => {
        console.log(`Gemini Nano download: ${Math.round(e.loaded*100)}%`);
      });
    }
  });
  return await session.prompt("Say hello from Gemini Nano!");
}

// ---- Generate insights from dataset profile (structured JSON) ----
export async function getInsightsFromStats(profile) {
  if (!('LanguageModel' in self)) throw new Error('Prompt API unavailable.');
  const availability = await LanguageModel.availability();
  if (availability === 'unavailable') throw new Error('Gemini Nano unavailable.');

  const session = await LanguageModel.create();
  const schema = {
    type: "object",
    properties: {
      key_findings: { type: "array", items: { type: "string" } },
      anomalies: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } }
    },
    required: ["key_findings","anomalies","recommendations"]
  };

  const prompt = `
You are a data analyst. Given this dataset profile JSON, produce:
- 3–7 key findings (plain English, non-technical)
- Up to 5 anomaly/quality notes (spikes, missing data, outliers)
- 3–5 action recommendations
JSON only.

Profile:
${JSON.stringify(profile)}
`;
  const result = await session.prompt(prompt, { responseConstraint: schema });
  const parsed = JSON.parse(result);
  return [
    'Key findings:\n- ' + parsed.key_findings.join('\n- '),
    'Anomalies:\n- ' + (parsed.anomalies.join('\n- ') || 'None detected'),
    'Recommendations:\n- ' + parsed.recommendations.join('\n- ')
  ].join('\n\n');
}

// ---- Summarizer API for executive summary ----
export async function getSummaryFromText(text) {
  if (!('Summarizer' in self)) throw new Error('Summarizer API unavailable.');
  const availability = await Summarizer.availability();
  if (availability === 'unavailable') throw new Error('Summarizer unavailable.');
  const summarizer = await Summarizer.create({
    type: 'key-points',
    format: 'markdown',
    length: 'medium',
    monitor(m) {
      m.addEventListener('downloadprogress', e => {
        console.log(`Summarizer model download: ${Math.round(e.loaded*100)}%`);
      });
    }
  });
  return await summarizer.summarize(text, {
    context: 'Audience is a business stakeholder; keep it concise and actionable.'
  });
}
