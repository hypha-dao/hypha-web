import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  parseIntelligenceFrontmatter,
  type ParsedIntelligenceFrontmatter,
} from './validation';
import type { IntelligenceArtifact } from './types';
import { contentSha } from './content-sha';

export type ParsedIntelligenceMarkdown = {
  frontmatter: ParsedIntelligenceFrontmatter;
  body: string;
  raw: string;
  sha: string;
};

/** Strip a single leading UTF-8 BOM if present (O(1)). */
function stripBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

/** Trim leading newlines without quantified regex (ReDoS-safe). */
function trimLeadingNewlines(value: string): string {
  let i = 0;
  while (i < value.length && (value[i] === '\n' || value[i] === '\r')) {
    i += 1;
  }
  return i === 0 ? value : value.slice(i);
}

/** Trim trailing newlines without quantified regex (ReDoS-safe). */
function trimTrailingNewlines(value: string): string {
  let i = value.length;
  while (i > 0 && (value[i - 1] === '\n' || value[i - 1] === '\r')) {
    i -= 1;
  }
  return i === value.length ? value : value.slice(0, i);
}

/**
 * Split `---` YAML frontmatter from markdown body with a linear scan.
 * Rejects executable gray-matter-style engines (`---js`, `---javascript`).
 * Does not evaluate frontmatter as code (no gray-matter / JS engines).
 */
export function splitIntelligenceFrontmatter(raw: string): {
  yaml: string;
  body: string;
} {
  const text = stripBom(raw);
  if (!text.startsWith('---')) {
    throw new Error(
      'Intelligence markdown must start with YAML frontmatter (---).',
    );
  }

  // Opening fence must be exactly `---` (optional CR) then newline — not ---js.
  let openEnd = 3;
  if (text[openEnd] === '\r') openEnd += 1;
  if (text[openEnd] !== '\n') {
    throw new Error(
      'Unsupported frontmatter fence. Only YAML (`---`) is allowed.',
    );
  }
  const yamlStart = openEnd + 1;

  let i = yamlStart;
  while (i < text.length) {
    // Start of a line
    if (text[i] === '-' && text[i + 1] === '-' && text[i + 2] === '-') {
      let j = i + 3;
      if (text[j] === '\r') j += 1;
      if (j >= text.length || text[j] === '\n') {
        const yaml = text.slice(yamlStart, i);
        const bodyStart = j < text.length ? j + 1 : j;
        return {
          yaml,
          body: trimLeadingNewlines(text.slice(bodyStart)),
        };
      }
    }
    // Advance to next line
    const nextNl = text.indexOf('\n', i);
    if (nextNl === -1) break;
    i = nextNl + 1;
  }

  throw new Error('Intelligence markdown frontmatter is not closed with ---.');
}

function parseFrontmatterYaml(yamlText: string): unknown {
  // `yaml` is a pure YAML 1.2 parser — no JS evaluation.
  return parseYaml(yamlText, {
    uniqueKeys: true,
    maxAliasCount: 50,
  });
}

export function parseIntelligenceMarkdown(
  raw: string,
): ParsedIntelligenceMarkdown {
  const { yaml, body } = splitIntelligenceFrontmatter(raw);
  const data = parseFrontmatterYaml(yaml);
  const frontmatter = parseIntelligenceFrontmatter(data);
  // Re-serialize raw from validated frontmatter so SHA is stable across writers.
  const rawCanonical = serializeIntelligenceMarkdown({ frontmatter, body });
  return {
    frontmatter,
    body: trimLeadingNewlines(body),
    raw: rawCanonical,
    sha: contentSha(rawCanonical),
  };
}

export function serializeIntelligenceMarkdown(input: {
  frontmatter: ParsedIntelligenceFrontmatter;
  body: string;
}): string {
  const body = trimTrailingNewlines(trimLeadingNewlines(input.body));
  const yaml = stringifyYaml(input.frontmatter, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'PLAIN',
  }).trimEnd();
  return `---\n${yaml}\n---\n${body ? `${body}\n` : ''}`;
}

export function toIntelligenceArtifact(input: {
  raw: string;
  path: string;
}): IntelligenceArtifact {
  const parsed = parseIntelligenceMarkdown(input.raw);
  return {
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    raw: parsed.raw,
    path: input.path,
    sha: parsed.sha,
  };
}
