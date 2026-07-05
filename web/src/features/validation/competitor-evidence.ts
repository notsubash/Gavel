import type { CompetitorIntelItem } from "@/lib/api/workspaces";

export function isCompetitorEvidenceType(type: string): boolean {
  return type === "ai_research" || type === "competitor_research";
}

export const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  interview_quote: "Interview quote",
  experiment_metric: "Experiment metric",
  loi: "LOI",
  payment: "Payment",
  founder_note: "Founder note",
  competitor_research: "Competitor research",
  ai_research: "AI research",
};

export const EVIDENCE_STRENGTH_LABEL: Record<string, string> = {
  strong: "Strong",
  moderate: "Moderate",
  weak: "Weak",
};

export type ParsedCompetitorEvidence = {
  title: string;
  rows: CompetitorIntelItem[];
  overallGap: string;
};

function parseSignalStrength(raw: string): CompetitorIntelItem["signal_strength"] {
  const value = raw.toLowerCase();
  if (value === "strong" || value === "weak" || value === "none") return value;
  return "weak";
}

function parseMarkdownLink(line: string): { title: string | null; url: string | null } {
  const match = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!match) return { title: null, url: null };
  return { title: match[1].trim(), url: match[2].trim() };
}

function parseMarkdownSection(section: string): CompetitorIntelItem | null {
  const lines = section.trim().split("\n");
  const header = lines[0]?.trim() ?? "";
  const headerMatch =
    header.match(/^(.+?)\s*·\s*(strong|weak|none)\s*$/i) ||
    header.match(/^(.+?)\s*\(\s*(strong|weak|none)\s*\)\s*$/i);
  if (!headerMatch) return null;

  let positioning = "";
  let gap_vs_us: string | null = null;
  let source_url: string | null = null;
  let source_title: string | null = null;

  for (const line of lines.slice(1)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("**Gap vs us:**")) {
      gap_vs_us = trimmed.replace(/^\*\*Gap vs us:\*\*\s*/i, "").trim() || null;
      continue;
    }
    if (trimmed.startsWith("**Source:**")) {
      const sourceBody = trimmed.replace(/^\*\*Source:\*\*\s*/i, "");
      if (/none matched/i.test(sourceBody)) {
        source_url = null;
        source_title = null;
        continue;
      }
      const link = parseMarkdownLink(sourceBody);
      source_url = link.url;
      source_title = link.title;
      if (!source_url && sourceBody.includes(" — ")) {
        const [title, url] = sourceBody.split(" — ");
        source_title = title.trim();
        source_url = url.trim();
      }
      continue;
    }
    if (trimmed.startsWith("Source:")) {
      const sourceBody = trimmed.replace(/^Source:\s*/i, "");
      if (/none matched/i.test(sourceBody)) continue;
      if (sourceBody.includes(" — ")) {
        const [title, url] = sourceBody.split(" — ");
        source_title = title.trim();
        source_url = url.trim();
      }
      continue;
    }
    if (trimmed.startsWith("Gap vs us:")) {
      gap_vs_us = trimmed.replace(/^Gap vs us:\s*/i, "").trim() || null;
      continue;
    }
    positioning = positioning ? `${positioning} ${trimmed}` : trimmed;
  }

  if (!positioning) return null;

  return {
    competitor: headerMatch[1].trim(),
    positioning,
    gap_vs_us,
    source_url,
    source_title,
    signal_strength: parseSignalStrength(headerMatch[2]),
  };
}

function parseMarkdownCompetitorEvidence(content: string): ParsedCompetitorEvidence | null {
  const overallSplit = content.split(/\n## Overall gap\s*\n/i);
  if (overallSplit.length !== 2) return null;

  const overallGap = overallSplit[1].trim();
  const head = overallSplit[0].trim();
  const titleMatch = head.match(/^##\s+(.+)/m);
  const title = titleMatch?.[1]?.trim() ?? "Competitor scan";
  const sections = head.split(/\n### /).slice(1);
  const rows = sections
    .map((section) => parseMarkdownSection(section))
    .filter((row): row is CompetitorIntelItem => row !== null);

  if (!rows.length || !overallGap) return null;
  return { title, rows, overallGap };
}

function parseLegacyRowBody(body: string): Pick<
  CompetitorIntelItem,
  "positioning" | "gap_vs_us" | "source_url" | "source_title"
> {
  let positioning = body;
  let gap_vs_us: string | null = null;
  let source_url: string | null = null;
  let source_title: string | null = null;

  const gapMatch = body.match(/(?:^|\s)Gap vs us:\s*([\s\S]*?)(?=\sSource:|$)/i);
  if (gapMatch) {
    gap_vs_us = gapMatch[1].trim() || null;
    positioning = body.slice(0, gapMatch.index).trim();
  }

  const sourceMatch = body.match(/(?:^|\s)Source:\s*([\s\S]*)$/i);
  if (sourceMatch) {
    const sourceBody = sourceMatch[1].trim();
    if (/none matched/i.test(sourceBody)) {
      source_url = null;
      source_title = null;
    } else if (sourceBody.includes(" — ")) {
      const [title, url] = sourceBody.split(" — ");
      source_title = title.trim();
      source_url = url.trim();
    } else {
      source_title = sourceBody;
    }
    if (gapMatch) {
      positioning = body.slice(0, gapMatch.index).trim();
    } else {
      positioning = body.slice(0, sourceMatch.index).trim();
    }
  }

  return {
    positioning: positioning.trim(),
    gap_vs_us,
    source_url,
    source_title,
  };
}

function splitLegacyRows(head: string): Array<{ name: string; strength: string; body: string }> {
  const markerRegex = /([A-Za-z0-9][A-Za-z0-9 .&'/-]*?)\s+\(\s*(strong|weak|none)\s*\)/gi;
  const markers: Array<{ index: number; name: string; strength: string; end: number }> = [];
  for (const match of head.matchAll(markerRegex)) {
    markers.push({
      index: match.index ?? 0,
      name: match[1].trim(),
      strength: match[2],
      end: (match.index ?? 0) + match[0].length,
    });
  }
  if (!markers.length) return [];

  const rows: Array<{ name: string; strength: string; body: string }> = [];
  for (let i = 0; i < markers.length; i += 1) {
    const start = markers[i].end;
    const end = i + 1 < markers.length ? markers[i + 1].index : head.length;
    rows.push({
      name: markers[i].name,
      strength: markers[i].strength,
      body: head.slice(start, end).trim(),
    });
  }
  return rows;
}

function parseLegacyCompetitorEvidence(content: string): ParsedCompetitorEvidence | null {
  const overallSplit = content.split(/\s*Overall gap:\s*/i);
  if (overallSplit.length !== 2) return null;

  const overallGap = overallSplit[1].trim();
  const head = overallSplit[0].trim();
  const titleMatch = head.match(/^Competitor scan for\s+(.+?)(?:\s+Edit before saving|$)/i);
  const title = titleMatch
    ? `Competitor scan for ${titleMatch[1].trim()}`
    : "Competitor scan";

  const firstMarker = head.search(/\S+\s+\(\s*(?:strong|weak|none)\s*\)/i);
  const rowSource = firstMarker >= 0 ? head.slice(firstMarker) : head;
  const legacyRows = splitLegacyRows(rowSource);
  const rows = legacyRows
    .map((row) => {
      const parsedBody = parseLegacyRowBody(row.body);
      if (!parsedBody.positioning) return null;
      return {
        competitor: row.name,
        positioning: parsedBody.positioning,
        gap_vs_us: parsedBody.gap_vs_us,
        source_url: parsedBody.source_url,
        source_title: parsedBody.source_title,
        signal_strength: parseSignalStrength(row.strength),
      } satisfies CompetitorIntelItem;
    })
    .filter((row): row is CompetitorIntelItem => row !== null);

  if (!rows.length || !overallGap) return null;
  return { title, rows, overallGap };
}

export function parseCompetitorEvidenceContent(content: string): ParsedCompetitorEvidence | null {
  const trimmed = content.trim();
  if (!trimmed.toLowerCase().includes("competitor scan")) return null;
  return parseMarkdownCompetitorEvidence(trimmed) ?? parseLegacyCompetitorEvidence(trimmed);
}
