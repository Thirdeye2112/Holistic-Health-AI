import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { ai as geminiAi } from "@workspace/integrations-gemini-ai";
import { zodSchemas } from "@workspace/api-zod";
import type { Logger } from "pino";
// import { getOrCreateUser, deductCredits } from "../lib/storage"; // disabled for testing

// ---------------------------------------------------------------------------
// In-memory job store — survives requests, cleaned up after 15 minutes
// ---------------------------------------------------------------------------
type AnalysisJobResult = {
  ailment: string;
  crossDisciplinaryThemes: string[];
  redFlags: string[];
  perspectives: unknown[];
  creditsUsed: number;
  creditsRemaining: number;
};

type Job = {
  status: "pending" | "done" | "error";
  result?: AnalysisJobResult;
  error?: string;
  createdAt: number;
};

const jobs = new Map<string, Job>();

setInterval(
  () => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [id, job] of jobs) {
      if (job.createdAt < cutoff) jobs.delete(id);
    }
  },
  5 * 60 * 1000,
);

const router: IRouter = Router();

type Discipline = {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  systemPrompt: string;
};

const DISCIPLINES: Discipline[] = [
  {
    id: "conventional",
    name: "Conventional Medicine",
    tagline: "Evidence-based allopathic perspective",
    accent: "#2C7A7B",
    systemPrompt:
      "You are a board-certified internal medicine physician trained in evidence-based Western medicine. Reason from differential diagnosis, pathophysiology, and clinical guidelines (UpToDate, NEJM, JAMA, Cochrane reviews, NICE/USPSTF). Reference relevant studies or guidelines briefly when useful.",
  },
  {
    id: "functional",
    name: "Functional Medicine",
    tagline: "Root-cause systems biology",
    accent: "#B45309",
    systemPrompt:
      "You are a functional medicine practitioner (IFM-trained). Identify root causes across antecedents, triggers, mediators. Consider gut, mitochondria, hormones, detoxification, inflammation. Cite functional medicine literature where relevant.",
  },
  {
    id: "naturopathic",
    name: "Naturopathic Medicine",
    tagline: "Whole-person natural healing",
    accent: "#15803D",
    systemPrompt:
      "You are a licensed naturopathic doctor. Apply the therapeutic order, address determinants of health, and consider botanical, nutritional, and lifestyle therapies. Cite naturopathic and integrative literature where useful.",
  },
  {
    id: "tcm",
    name: "Traditional Chinese Medicine",
    tagline: "Pattern differentiation, qi & meridians",
    accent: "#B91C1C",
    systemPrompt:
      "You are a TCM doctor. Diagnose by pattern differentiation (zang-fu, qi/blood/yin/yang, six channels, eight principles). Suggest acupuncture points and classical herbal formulas. Reference Bensky, Maciocia, and Cochrane TCM reviews where relevant.",
  },
  {
    id: "ayurveda",
    name: "Ayurveda",
    tagline: "Doshas, agni, and constitution",
    accent: "#C2410C",
    systemPrompt:
      "You are an Ayurvedic physician (BAMS). Diagnose by dosha imbalance (vata, pitta, kapha), agni, ama, dhatus, and srotas. Suggest dinacharya, diet by dosha, and classical herbs. Cite Charaka, Sushruta, and modern ayurvedic research where relevant.",
  },
  {
    id: "chiropractic",
    name: "Chiropractic & Musculoskeletal",
    tagline: "Spine, nerves, and movement",
    accent: "#1D4ED8",
    systemPrompt:
      "You are a chiropractor and musculoskeletal specialist. Consider spinal subluxations, joint dysfunction, posture, gait, myofascial trigger points, and nerve entrapment. Reference orthopedic and manual therapy literature.",
  },
  {
    id: "osteopathic",
    name: "Osteopathic Medicine",
    tagline: "Structure-function & manual treatment",
    accent: "#0E7490",
    systemPrompt:
      "You are a DO trained in osteopathic manipulative treatment (OMT). Apply somatic dysfunction, fascial restrictions, lymphatic and visceral techniques. Reference Foundations of Osteopathic Medicine and current OMT research.",
  },
  {
    id: "nutrition",
    name: "Clinical Nutrition",
    tagline: "Micronutrients, diet, and metabolism",
    accent: "#65A30D",
    systemPrompt:
      "You are a clinical/registered dietitian nutritionist. Consider macronutrients, micronutrient deficiencies, food sensitivities, glycemic load, gut microbiome, and metabolic biomarkers. Reference peer-reviewed nutrition research.",
  },
  {
    id: "psychology",
    name: "Mind-Body & Psychology",
    tagline: "Stress, trauma, and somatic patterns",
    accent: "#7C3AED",
    systemPrompt:
      "You are a clinical psychologist with mind-body and trauma-informed training (polyvagal, somatic experiencing, ACT, CBT). Consider stress, autonomic dysregulation, trauma, sleep, and psychosocial factors. Reference relevant psychological literature.",
  },
  {
    id: "homeopathy",
    name: "Homeopathy",
    tagline: "Constitutional remedy matching",
    accent: "#0891B2",
    systemPrompt:
      "You are a classical homeopath. Consider the totality of symptoms, modalities, and mental/general/physical picture. Suggest a few candidate remedies with rationale (e.g., Bryonia, Pulsatilla, Nux vomica). Be transparent that homeopathy's evidence base is contested.",
  },
];

const ACCENT_BY_ID = new Map(DISCIPLINES.map((d) => [d.id, d.accent] as const));
const NAME_BY_ID = new Map(DISCIPLINES.map((d) => [d.id, d.name] as const));

router.get("/medlens/disciplines", (_req, res) => {
  res.json(
    DISCIPLINES.map(({ id, name, tagline, accent }) => ({
      id,
      name,
      tagline,
      accent,
    })),
  );
});

type FollowupAnswer = {
  disciplineId: string;
  question: string;
  answer: string;
};

type ImageData = {
  base64: string;
  mimeType: string;
};

type AnalyzeBody = {
  ailment: string;
  age?: number | null;
  sex?: string | null;
  history?: string | null;
  followupAnswers?: FollowupAnswer[];
  mode?: "light" | "standard" | "premium" | null;
  disciplines?: string[] | null;
  imageBase64?: string | null;
  imageMimeType?: string | null;
  labResults?: string | null;
};

type Diagnosis = {
  condition: string;
  likelihood: string;
  rationale: string;
};

type DisciplineResponse = {
  summary: string;
  diagnoses: Diagnosis[];
  adjacentIssues: string[];
  recommendations: string[];
  followUpQuestions: string[];
  evidenceNotes: string[];
  recommendedTests: string[];
};

function buildContext(body: AnalyzeBody): string {
  const lines: string[] = [];
  lines.push(`Primary complaint: ${body.ailment}`);
  if (body.age != null) lines.push(`Age: ${body.age}`);
  if (body.sex) lines.push(`Sex: ${body.sex}`);
  if (body.history) lines.push(`History / context: ${body.history}`);
  if (body.imageBase64) lines.push(`[Patient has also attached a photo for visual examination]`);
  if (body.labResults?.trim()) lines.push(`\nLab results / test data provided by patient:\n${body.labResults.trim()}`);
  return lines.join("\n");
}

function buildFollowupContext(
  body: AnalyzeBody,
  disciplineId: string,
): string {
  const relevant = (body.followupAnswers ?? []).filter(
    (a) => a.disciplineId === disciplineId || a.disciplineId === "shared",
  );
  if (relevant.length === 0) return "";
  return [
    "\nPreviously answered follow-up questions:",
    ...relevant.map((a) => `- Q: ${a.question}\n  A: ${a.answer}`),
  ].join("\n");
}

const PANEL_INSTRUCTION = `You are part of a multi-disciplinary medical panel. Stay strictly in character for your discipline. Reason thoroughly. Be honest about uncertainty. Flag any symptom suggesting urgent care.

Mandatory operating standards — follow these for every response:
1. Adopt the role of the most qualified subject-matter expert(s) for your discipline and answer with authoritative, nuanced depth.
2. Cite your sources. Reference specific guidelines, studies, textbooks, or authoritative bodies wherever you make factual claims (e.g. "per Cochrane 2022 review...", "JAMA 2021 found...").
3. Never sacrifice accuracy for speed. Double-check your reasoning before presenting it. Verify information against known sources; note the source's credibility.
4. Do not guess, speculate, or hallucinate. If information is conjecture or based on limited evidence, explicitly flag it with a phrase such as "Possible — limited evidence" or "Theoretical — not yet established in clinical literature."
5. Omit ethical or moral commentary unless the topic explicitly requires it; focus on clinical and scientific content.
6. Keep each response unique and free of repetition — do not restate the same point across sections.
7. Focus on the key points of the patient's question to determine clinical intent before answering.
8. Break down complex diagnostic or therapeutic reasoning into clear, sequential steps, explaining the rationale at each step.
9. Where appropriate, provide multiple diagnostic or treatment perspectives rather than a single conclusion.
10. If the patient's complaint is unclear or ambiguous, include a clarifying follow-up question before committing to a diagnosis.
11. If any prior reasoning in this session was in error, acknowledge and correct it explicitly.
12. After your main response, include exactly three follow-up questions the patient might ask next, formatted in bold as Q1, Q2, and Q3. Make them thought-provoking and clinically deeper than the original question.
13. Do not be sycophantic. If the patient's stated assumptions are factually incorrect or their reasoning is flawed, say so clearly and provide the corrected information with supporting citations.`;

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    diagnoses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          condition: { type: "string" },
          likelihood: { type: "string" },
          rationale: { type: "string" },
        },
        required: ["condition", "likelihood", "rationale"],
      },
    },
    adjacentIssues: { type: "array", items: { type: "string" } },
    recommendations: { type: "array", items: { type: "string" } },
    followUpQuestions: { type: "array", items: { type: "string" } },
    evidenceNotes: { type: "array", items: { type: "string" } },
    recommendedTests: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary",
    "diagnoses",
    "adjacentIssues",
    "recommendations",
    "followUpQuestions",
    "evidenceNotes",
    "recommendedTests",
  ],
} as const;

const CROSS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    crossDisciplinaryThemes: { type: "array", items: { type: "string" } },
    redFlags: { type: "array", items: { type: "string" } },
  },
  required: ["crossDisciplinaryThemes", "redFlags"],
} as const;

async function getGPTPerspective(
  discipline: Discipline,
  userPrompt: string,
  imageData?: ImageData | null,
): Promise<string> {
  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const userContent: ContentPart[] = [{ type: "text", text: userPrompt }];
  if (imageData) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` },
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 4096,
    messages: [
      {
        role: "system",
        content: `${discipline.systemPrompt}\n\n${PANEL_INSTRUCTION}`,
      },
      { role: "user", content: imageData ? userContent : userPrompt },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

async function getClaudePerspective(
  discipline: Discipline,
  userPrompt: string,
  imageData?: ImageData | null,
): Promise<string> {
  type ClaudeContent =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  const userContent: ClaudeContent[] = [];
  if (imageData) {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: imageData.mimeType, data: imageData.base64 },
    });
  }
  userContent.push({ type: "text", text: userPrompt });

  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8192,
    system: `${discipline.systemPrompt}\n\n${PANEL_INSTRUCTION}`,
    messages: [{ role: "user", content: imageData ? userContent : userPrompt }],
  });
  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}

async function getGeminiPerspective(
  discipline: Discipline,
  userPrompt: string,
  imageData?: ImageData | null,
): Promise<string> {
  type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
  const parts: GeminiPart[] = [];
  if (imageData) {
    parts.push({ inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } });
  }
  parts.push({ text: userPrompt });

  const response = await geminiAi.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [{ role: "user", parts }],
    config: {
      maxOutputTokens: 8192,
      systemInstruction: `${discipline.systemPrompt}\n\n${PANEL_INSTRUCTION}`,
    },
  });
  return response.text ?? "";
}

async function synthesizePerspectives(
  discipline: Discipline,
  gptText: string,
  claudeText: string,
  geminiText: string,
  context: string,
): Promise<DisciplineResponse> {
  const systemPrompt = `You are a master synthesizer for a multi-AI medical panel. Three world-class AI models — GPT-5.4, Claude Opus, and Gemini Pro — have each independently reasoned through a patient case from the ${discipline.name} perspective. Your role is to collate their analyses into one authoritative, cohesive perspective.

Guidelines:
- Diagnoses: Merge and deduplicate. Where models agree, combine the best rationale. Where they diverge, use clinical judgment to assign likelihood; note genuine disagreements.
- Adjacent issues: Include unique insights from each model; remove true duplicates.
- Recommendations: Keep the most actionable and discipline-specific suggestions; deduplicate.
- Follow-up questions: Select the most diagnostically valuable questions across all three analyses.
- Evidence notes: Include the strongest citations and references raised by any model.
- Summary: Write a rich, integrated narrative that captures what all three AI perspectives collectively reveal — including where they converge and where they offer complementary angles. Acknowledge when models surface unique insights the others missed.

Output valid JSON only.`;

  const userPrompt = `Patient presentation:\n${context}\n\n--- GPT-5.4 (${discipline.name}) ---\n${gptText}\n\n--- Claude Opus (${discipline.name}) ---\n${claudeText}\n\n--- Gemini Pro (${discipline.name}) ---\n${geminiText}\n\nSynthesize these three perspectives into one cohesive ${discipline.name} analysis.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 8192,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "DisciplineAnalysis",
        strict: true,
        schema: ANALYSIS_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const choice = response.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error(`Response truncated for discipline ${discipline.id} (synthesis)`);
  }
  const content = choice?.message?.content ?? "{}";
  return JSON.parse(content) as DisciplineResponse;
}

async function analyzeDisciplineStandard(
  discipline: Discipline,
  body: AnalyzeBody,
  context: string,
): Promise<DisciplineResponse> {
  const followupContext = buildFollowupContext(body, discipline.id);
  const userPrompt = `Patient presentation:\n${context}${followupContext}\n\nProvide your perspective as a ${discipline.name} practitioner. Be focused and discipline-specific. Include: 2-4 differential diagnoses ranked by likelihood with a brief rationale each; 3-5 adjacent contributing issues; 4-6 actionable recommendations; 2-3 targeted follow-up questions; 2-4 relevant evidence references; 3-5 recommended tests or investigations. Quality over quantity — be concise and clinically useful. Output valid JSON only.`;

  const imageData: ImageData | null =
    body.imageBase64 && body.imageMimeType
      ? { base64: body.imageBase64, mimeType: body.imageMimeType }
      : null;

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } };

  const userContent: ContentPart[] = [{ type: "text", text: userPrompt }];
  if (imageData) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${imageData.mimeType};base64,${imageData.base64}` },
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2500,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "DisciplineAnalysis",
        strict: true,
        schema: ANALYSIS_SCHEMA,
      },
    },
    messages: [
      {
        role: "system",
        content: `${discipline.systemPrompt}\n\n${PANEL_INSTRUCTION}`,
      },
      { role: "user", content: imageData ? userContent : userPrompt },
    ],
  });

  const choice = response.choices[0];
  if (choice?.finish_reason === "length") {
    throw new Error(`Response truncated for discipline ${discipline.id} (standard)`);
  }
  const content = choice?.message?.content ?? "{}";
  return JSON.parse(content) as DisciplineResponse;
}

async function analyzeDiscipline(
  discipline: Discipline,
  body: AnalyzeBody,
  context: string,
): Promise<DisciplineResponse> {
  const mode = body.mode ?? "premium";

  if (mode === "standard" || mode === "light") {
    return analyzeDisciplineStandard(discipline, body, context);
  }

  const followupContext = buildFollowupContext(body, discipline.id);
  const userPrompt = `Patient presentation:\n${context}${followupContext}\n\nProvide your perspective as a ${discipline.name} practitioner. Be thorough and discipline-specific. Cover differential diagnoses (ranked by likelihood with rationale), adjacent contributing issues, actionable recommendations, targeted follow-up questions, and relevant evidence or classical references.`;

  const imageData: ImageData | null =
    body.imageBase64 && body.imageMimeType
      ? { base64: body.imageBase64, mimeType: body.imageMimeType }
      : null;

  const [gptText, claudeText, geminiText] = await Promise.all([
    getGPTPerspective(discipline, userPrompt, imageData).catch(() => ""),
    getClaudePerspective(discipline, userPrompt, imageData).catch(() => ""),
    getGeminiPerspective(discipline, userPrompt, imageData).catch(() => ""),
  ]);

  return synthesizePerspectives(discipline, gptText, claudeText, geminiText, context);
}

async function analyzeCrossThemes(
  body: AnalyzeBody,
  context: string,
  perspectives: { disciplineName: string; summary: string }[],
): Promise<{ crossDisciplinaryThemes: string[]; redFlags: string[] }> {
  const summaries = perspectives
    .map((p) => `- ${p.disciplineName}: ${p.summary}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 1024,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "CrossThemes",
        strict: true,
        schema: CROSS_SCHEMA,
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You are a senior integrative medicine physician synthesizing perspectives from a multi-disciplinary panel (each perspective was itself synthesized from GPT, Claude, and Gemini analyses). Identify cross-cutting themes (patterns that appear across disciplines) and any red flags requiring urgent in-person care.",
      },
      {
        role: "user",
        content: `Presentation:\n${context}\n\nPanel perspectives:\n${summaries}\n\nReturn 3-6 cross-disciplinary themes and any red flags. Output valid JSON.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

const CREDIT_COST = { light: 0, standard: 1, premium: 3 } as const;

// ---------------------------------------------------------------------------
// Core analysis logic — runs as a background job
// ---------------------------------------------------------------------------
async function runAnalysis(jobId: string, body: AnalyzeBody, log: Logger): Promise<void> {
  const mode = body.mode ?? "premium";

  let activeDisciplines = DISCIPLINES;
  if (mode === "light") {
    const chosen = body.disciplines ?? [];
    activeDisciplines =
      chosen.length > 0
        ? DISCIPLINES.filter((d) => chosen.includes(d.id))
        : DISCIPLINES.slice(0, 3);
  }

  try {
    const context = buildContext(body);
    const t0 = Date.now();

    const settled = await Promise.allSettled(
      activeDisciplines.map(async (d) => {
        const dt = Date.now();
        const result = await analyzeDiscipline(d, body, context);
        log.info({ discipline: d.id, mode, ms: Date.now() - dt }, "Discipline done");
        return result;
      }),
    );

    log.info({ mode, disciplines: activeDisciplines.length, totalMs: Date.now() - t0 }, "All disciplines done");

    const perspectives = settled
      .map((result, idx) => {
        const discipline = activeDisciplines[idx]!;
        if (result.status === "rejected") {
          log.error({ err: result.reason, discipline: discipline.id }, "Discipline analysis failed");
          return {
            disciplineId: discipline.id,
            disciplineName: discipline.name,
            accent: discipline.accent,
            summary: "This perspective could not be generated for this query. Please try again.",
            diagnoses: [],
            adjacentIssues: [],
            recommendations: [],
            followUpQuestions: [],
            evidenceNotes: [],
            recommendedTests: [],
          };
        }
        const data = result.value;
        return {
          disciplineId: discipline.id,
          disciplineName: discipline.name,
          accent: discipline.accent,
          summary: data.summary,
          diagnoses: data.diagnoses,
          adjacentIssues: data.adjacentIssues,
          recommendations: data.recommendations,
          followUpQuestions: data.followUpQuestions,
          evidenceNotes: data.evidenceNotes,
          recommendedTests: data.recommendedTests ?? [],
        };
      })
      .filter((p) => p.summary.length > 0);

    let cross: { crossDisciplinaryThemes: string[]; redFlags: string[] } = {
      crossDisciplinaryThemes: [],
      redFlags: [],
    };
    try {
      cross = await analyzeCrossThemes(
        body,
        context,
        perspectives.map((p) => ({ disciplineName: p.disciplineName, summary: p.summary })),
      );
    } catch (err) {
      log.error({ err }, "Cross-discipline synthesis failed");
    }

    jobs.set(jobId, {
      status: "done",
      result: {
        ailment: body.ailment,
        crossDisciplinaryThemes: cross.crossDisciplinaryThemes,
        redFlags: cross.redFlags,
        perspectives,
        creditsUsed: 0,
        creditsRemaining: 999,
      },
      createdAt: jobs.get(jobId)!.createdAt,
    });

    log.info({ jobId, totalMs: Date.now() - t0 }, "Job completed");
  } catch (err) {
    log.error({ err, jobId }, "Job failed");
    jobs.set(jobId, {
      status: "error",
      error: err instanceof Error ? err.message : "Analysis failed",
      createdAt: jobs.get(jobId)!.createdAt,
    });
  }
}

// POST — validate, create job, return jobId immediately
router.post("/medlens/analyze", async (req, res) => {
  const parsed = zodSchemas.AnalyzeAilmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const body = parsed.data as AnalyzeBody;

  if (!body.ailment.trim()) {
    res.status(400).json({ error: "Ailment description is required" });
    return;
  }

  const jobId = randomUUID();
  jobs.set(jobId, { status: "pending", createdAt: Date.now() });

  // Fire and forget — do NOT await
  void runAnalysis(jobId, body, req.log);

  res.json({ jobId });
});

// GET — poll job status
router.get("/medlens/job/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    status: job.status,
    result: job.result ?? null,
    error: job.error ?? null,
  });
});

void ACCENT_BY_ID;
void NAME_BY_ID;

export default router;
