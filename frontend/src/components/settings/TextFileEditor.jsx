import { useEffect, useState } from 'react';
import * as settingsApi from '../../services/settingsApi';

function TextFileEditor({ filename }) {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    useEffect(() => {
        loadFile();
    }, [filename]);

    const loadFile = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await settingsApi.getTextFileSettings(filename);
            setContent(data?.content || '');
        } catch (err) {
            setError(err.message + '. Check if Server Path is correct.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        try {
            await settingsApi.saveTextFileSettings(filename, content);
            setSuccess(`${filename} saved successfully!`);
        } catch (err) {
            setError(err.message);
        }
    };

    if (loading) return <div>Loading {filename}...</div>;

    return (
        <div className="card">
            <h2 className="card-title">Editing: {filename}</h2>

            {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}
            {success && <div className="status-badge status-online" style={{ marginBottom: '1rem', display: 'block' }}>{success}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <textarea
                        value={content}
                        onChange={(e) => {
                            setContent(e.target.value);
                            setSuccess(null);
                        }}
                        className="input-field"
                        style={{
                            minHeight: '420px',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre',
                            tabSize: 4
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button type="submit" className="btn btn-primary">Save Changes</button>
                    <button type="button" onClick={loadFile} className="btn btn-secondary">Reload File</button>
                </div>
            </form>
        </div>
    );
}

export default TextFileEditor;