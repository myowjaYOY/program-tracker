import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MetricSnapshot {
  label: string;
  actual: number | null;
  target: number | null;
  expected: number | null;
  status: string;
  section: string;
  valueType: string;
}

interface CacheEntry {
  insight: string;
  constraint: string;
  generatedAt: number;
  metricsHash: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
let cache: CacheEntry | null = null;

function hashMetrics(metrics: MetricSnapshot[]): string {
  return metrics
    .map((m) => `${m.label}:${m.actual}:${m.target}:${m.status}`)
    .join('|');
}

function buildPrompt(metrics: MetricSnapshot[]): string {
  const lines = metrics.map((m) => {
    const actualStr = m.actual != null ? String(m.actual) : 'N/A';
    const targetStr = m.target != null ? String(m.target) : 'N/A';
    const suffix = m.valueType === 'currency' ? ' (USD)' : m.valueType === 'percent' ? '%' : '';
    return `- ${m.label} [${m.section}]: actual=${actualStr}${suffix}, target=${targetStr}${suffix}, status=${m.status}`;
  });

  return `Analyze this health & wellness program management company's dashboard using Theory of Constraints thinking. This company sells wellness programs (memberships, packages) and tracks performance across three distinct business domains, each representing a SEPARATE CHAIN:

BUSINESS MODEL CONTEXT:
1. FINANCIAL_HEALTH — Revenue outcomes: Collections (cash received), Booked Sales (new revenue signed), Program Margin, and Membership Revenue % (share of revenue from membership-type programs). Booked Sales is the direct output of the marketing/sales funnel.
2. MARKETING_ENGINE — The sales funnel, read top-to-bottom: Leads generated → Show Rate (% of leads who attend a sales event/seminar) → PMEs Scheduled (consultations booked) → Close Rate (% of PMEs that convert to a sale). These are sequential stages — a drop at any stage compounds downstream.
3. DELIVERY_MODEL_STRENGTH — Client retention and program quality: Active Clients, Avg Satisfaction Score, Overall Compliance % (client adherence to prescribed protocols like nutrition, exercise, supplements), and Dropouts (program cancellations — lower is better). These metrics are about EXISTING clients, completely independent of the marketing funnel.

CRITICAL RULES:
- Marketing Engine and Delivery Model Strength are INDEPENDENT problem domains. Marketing affects prospects (people who haven't bought yet). Delivery affects existing clients (people already in programs). Fixing one does NOT fix the other. Do NOT fabricate causal links between them.
- If two domains both have problems, say they are SEPARATE problems requiring separate solutions. Do not weave them into one connected narrative.
- Only connect metrics that have a real upstream/downstream relationship: Leads → Show Rate → PMEs → Close Rate → Booked Sales → Collections. That's the funnel. Compliance, satisfaction, and dropouts are a separate retention loop.

CURRENT MONTH METRICS:
${lines.join('\n')}

INSTRUCTIONS:
The CEO has the dashboard open — do NOT narrate it back. No metric values, no restating what's behind or on watch.

Apply Theory of Constraints — STRICTLY:
- The ENTIRE business has ONE primary constraint right now. Not one per domain. ONE total. Find it.
- The constraint is the single metric that, if improved, would produce the largest throughput gain for the whole system. Everything else is subordinate to it.
- Explain in concrete terms what throughput the business is losing because of this ONE constraint, and what specifically breaks in 30-60 days if it stays unresolved.
- After identifying the primary constraint, briefly note what becomes the NEXT constraint once the first is resolved.

Do NOT split your analysis across multiple domains. Do NOT try to address everything. Goldratt's rule: a system has ONE constraint at a time. Find it. Name it. Explain it.

TONE: Blunt, precise, no hedging, no generic statements like "cash flow issues" or "eroding profitability."

FORMAT:
- First line: ONLY the name of the primary constraint metric (e.g., "Show Rate" or "Leads" or "Overall Compliance %"). Nothing else on this line.
- Then a blank line.
- Then exactly 4 sentences as a single paragraph. No labels, no headers, no bullet points, no pleasantries.`;

/* --- PREVIOUS PROMPT (v1) --- keep for rollback ---
INSTRUCTIONS:
The CEO can already see which metrics are behind or on watch — do NOT simply summarize or narrate the dashboard. Instead, provide INSIGHT the CEO cannot easily see by just looking at the numbers:
- Identify non-obvious connections: how do weaknesses in one area compound or accelerate problems in another? What is the second-order effect?
- Call out blind spots: what risk might the CEO be underestimating? What looks manageable in isolation but is dangerous in combination?
- Project forward: if these trends continue, what is the likely business impact in the next 30-60 days?
- Do NOT restate metric values — the CEO has the dashboard open.
- 3-4 sentences. Direct, sharp, no hedging, no bullet points, no pleasantries.
--- END PREVIOUS PROMPT --- */
}

export async function POST(request: Request) {
  try {
    const { metrics } = (await request.json()) as { metrics: MetricSnapshot[] };

    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json({ error: 'metrics array is required' }, { status: 400 });
    }

    const hash = hashMetrics(metrics);
    const now = Date.now();

    if (cache && cache.metricsHash === hash && now - cache.generatedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        insight: cache.insight,
        constraint: cache.constraint,
        cached: true,
        generatedAt: new Date(cache.generatedAt).toISOString(),
      });
    }

    console.log('[Executive Insight] Calling OpenAI GPT-4o...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are Eliyahu Goldratt, creator of the Theory of Constraints. You analyze business systems by identifying the single binding constraint that limits total throughput. You think in chains — a system is only as strong as its weakest link. You never try to optimize everything at once; you find THE constraint, explain why it is the constraint, and subordinate all other decisions to it. You treat independent subsystems as separate chains — if Marketing and Delivery are both weak, they are two separate constraints, not one connected problem. You are blunt, precise, and never waste words. You never summarize what the CEO can already see on the dashboard.' },
        { role: 'user', content: buildPrompt(metrics) },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

    const raw =
      completion.choices[0]?.message?.content?.trim() ||
      'Unable to generate insight at this time.';

    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
    const constraint = lines[0] ?? '';
    const insight = lines.slice(1).join('\n').trim() || raw;

    console.log('[Executive Insight] Response received, caching for 60 minutes.');

    cache = { insight, constraint, generatedAt: now, metricsHash: hash };

    return NextResponse.json({
      insight,
      constraint,
      cached: false,
      generatedAt: new Date(now).toISOString(),
    });
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error('[Executive Insight] OpenAI API Error:', error.status, error.message, error.code, error.type);
      return NextResponse.json(
        { error: 'AI service error', message: error.message, code: error.code, type: error.type, status: error.status },
        { status: 502 }
      );
    }
    console.error('[Executive Insight] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
