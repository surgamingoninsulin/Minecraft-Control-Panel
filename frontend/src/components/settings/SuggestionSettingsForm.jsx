import { useState } from 'react';
import * as settingsApi from '../../services/settingsApi';

function buildTemplate(category) {
  const entryId = category === 'mods' ? 'example-mod' : (category === 'datapacks' ? 'example-datapack' : 'example-plugin');
  const entryName = category === 'mods' ? 'Example Mod' : (category === 'datapacks' ? 'Example Datapack' : 'Example Plugin');
  return JSON.stringify({
    [category]: [
      {
        id: entryId,
        name: entryName,
        author: 'Example Author',
        minecraftVersion: '1.21.11',
        version: '1.0.0',
        image: 'https://example.com/logo.png',
        directDownloadUrl: 'https://example.com/download.jar',
        description: 'Example description',
        websiteUrl: 'https://example.com',
        dependencies: []
      }
    ]
  }, null, 2);
}

function SuggestionSettingsForm() {
  const [category, setCategory] = useState('plugins');
  const [content, setContent] = useState(buildTemplate('plugins'));
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
        Submit JSON only. Text above/below is not allowed.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
        <div className="form-group">
          <label>Category</label>
          <select
            className="input-field"
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              setCategory(next);
              setContent(buildTemplate(next));
            }}
          >
            <option value="plugins">Plugins</option>
            <option value="datapacks">Datapacks</option>
            <option value="mods">Mods</option>
          </select>
        </div>

        <div className="form-group">
          <label>Suggestion JSON</label>
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
