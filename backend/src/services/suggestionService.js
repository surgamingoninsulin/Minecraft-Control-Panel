import axios from 'axios';

const DEFAULT_GIST_URL = 'https://gist.github.com/surgamingoninsulin/2b4d90991a5a5a025f69cce2282f67b7';
const DEFAULT_REPO = 'surgamingoninsulin/minecraft-panel';
const ALLOWED_TOP_LEVEL_KEYS = new Set(['plugins', 'datapacks', 'mods']);

function extractJsonCodeBlock(input) {
  const text = String(input || '');
  const jsonFence = text.match(/```json\s*([\s\S]*?)```/i);
  if (jsonFence?.[1]) return jsonFence[1].trim();
  const anyFence = text.match(/```\s*([\s\S]*?)```/i);
  if (anyFence?.[1]) return anyFence[1].trim();
  return '';
}

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'plugin' || raw === 'plugins') return 'plugins';
  if (raw === 'mod' || raw === 'mods') return 'mods';
  if (raw === 'datapack' || raw === 'datapacks') return 'datapacks';
  return '';
}

function normalizeParsedPayload(parsed, categoryHint = '') {
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  const out = {};

  for (const key of ALLOWED_TOP_LEVEL_KEYS) {
    if (Array.isArray(source[key])) out[key] = source[key];
  }

  // Allow a single-entry object as a convenience and map it into category hint.
  if (Object.keys(out).length === 0 && categoryHint) {
    out[categoryHint] = [source];
  }

  return out;
}

function deriveTitle(payload, categoryHint = '') {
  const categoryOrder = categoryHint
    ? [categoryHint, ...Array.from(ALLOWED_TOP_LEVEL_KEYS).filter((k) => k !== categoryHint)]
    : Array.from(ALLOWED_TOP_LEVEL_KEYS);

  for (const category of categoryOrder) {
    const rows = Array.isArray(payload?.[category]) ? payload[category] : [];
    if (!rows.length) continue;
    const first = rows[0] || {};
    const display = String(first.name || first.id || 'Unnamed entry').trim();
    return `[Gist Suggestion] ${category}: ${display}`;
  }
  return '[Gist Suggestion] New provider entry';
}

class SuggestionService {
  getRepoRef() {
    return String(process.env.GITHUB_ISSUE_REPO || DEFAULT_REPO).trim() || DEFAULT_REPO;
  }

  parseRepoRef() {
    const repoRef = this.getRepoRef();
    const parts = repoRef.split('/').map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 2) {
      throw new Error('GITHUB_ISSUE_REPO must be in owner/repo format');
    }
    return { owner: parts[0], repo: parts[1], repoRef };
  }

  buildIssueBody({ message = '', jsonBlock = '', normalizedPayload = {}, requestedBy = 'unknown' } = {}) {
    const compactMessage = String(message || '').trim();
    const payloadText = JSON.stringify(normalizedPayload, null, 2);
    return [
      `New gist suggestion submitted from the Minecraft Panel settings.`,
      ``,
      `Requested by: ${requestedBy}`,
      `Target gist: ${DEFAULT_GIST_URL}`,
      ``,
      compactMessage ? `User message (outside JSON block):\n${compactMessage}` : 'User message (outside JSON block): (none)',
      ``,
      `Parsed JSON block:`,
      '```json',
      payloadText,
      '```',
      ``,
      `Raw JSON block received:`,
      '```json',
      jsonBlock,
      '```'
    ].join('\n');
  }

  async createGistSuggestionIssue({ rawText = '', category = '', requestedBy = 'unknown' } = {}) {
    const token = String(process.env.GITHUB_ISSUE_TOKEN || '').trim();
    if (!token || token === '<github_api_token_here>') {
      throw new Error('GITHUB_ISSUE_TOKEN is missing in backend/.env');
    }

    const categoryHint = normalizeCategory(category);
    const jsonBlock = extractJsonCodeBlock(rawText);
    if (!jsonBlock) {
      throw new Error('No JSON code block found. Include the suggestion inside ```json ... ```');
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonBlock);
    } catch (err) {
      throw new Error(`Invalid JSON block: ${err.message}`);
    }

    const normalizedPayload = normalizeParsedPayload(parsed, categoryHint);
    const topKeys = Object.keys(normalizedPayload);
    if (!topKeys.length) {
      throw new Error('JSON must contain at least one of: plugins, datapacks, mods');
    }

    const title = deriveTitle(normalizedPayload, categoryHint);
    const body = this.buildIssueBody({
      message: String(rawText || '').replace(/```json[\s\S]*?```/i, '').replace(/```[\s\S]*?```/i, '').trim(),
      jsonBlock,
      normalizedPayload,
      requestedBy
    });

    const { owner, repo, repoRef } = this.parseRepoRef();
    const issuePayload = {
      title,
      body,
      labels: ['gist-suggestion']
    };

    const response = await axios.post(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      issuePayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'minecraft-panel-suggestions'
        }
      }
    );

    return {
      success: true,
      repo: repoRef,
      issueNumber: response.data?.number,
      issueUrl: response.data?.html_url,
      parsedCategories: topKeys
    };
  }
}

export default new SuggestionService();
