import { useState } from 'react';
import * as settingsApi from '../../services/settingsApi';

const EXAMPLE = `Message above the JSON is allowed.

\`\`\`json
{
  "plugins": [
    {
      "id": "example-plugin",
      "name": "Example Plugin",
      "author": "Example Author",
      "minecraftVersion": "1.21.11",
      "version": "1.0.0",
      "image": "https://example.com/logo.png",
      "directDownloadUrl": "https://example.com/plugin.jar",
      "description": "Example description",
      "websiteUrl": "https://example.com",
      "dependencies": []
    }
  ]
}
\`\`\`

Text below is also allowed.`;

function SuggestionSettingsForm() {
  const [category, setCategory] = useState('plugins');
  const [content, setContent] = useState(EXAMPLE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const response = await settingsApi.submitGistSuggestion({ category, content });
      setResult(response);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to submit suggestion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="settings-card">
      <h3>Gist Suggestions</h3>
      <p style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
        Submit a suggestion as a GitHub issue. Only JSON inside the <code>```json</code> block is parsed.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <div className="form-group">
          <label>Category</label>
          <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="plugins">Plugins</option>
            <option value="datapacks">Datapacks</option>
            <option value="mods">Mods</option>
          </select>
        </div>

        <div className="form-group">
          <label>Suggestion Message + JSON Block</label>
          <textarea
            className="input-field"
            rows={16}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Create GitHub Issue'}
        </button>
      </form>

      {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
      {result?.issueUrl && (
        <div className="success-text" style={{ marginTop: 10 }}>
          Issue created: <a href={result.issueUrl} target="_blank" rel="noreferrer">{result.issueUrl}</a>
        </div>
      )}
    </div>
  );
}

export default SuggestionSettingsForm;
