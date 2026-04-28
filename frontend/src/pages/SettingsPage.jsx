import { useEffect, useState } from 'react';
import PanelSettingsForm from '../components/settings/PanelSettingsForm';
import ServerSettingsForm from '../components/settings/ServerSettingsForm';
import ProviderApiSettingsForm from '../components/settings/ProviderApiSettingsForm';
import ProviderSourcesSettingsForm from '../components/settings/ProviderSourcesSettingsForm';
import SuggestionSettingsForm from '../components/settings/SuggestionSettingsForm';
import JsonFileEditor from '../components/settings/JsonFileEditor';
import TextFileEditor from '../components/settings/TextFileEditor';
import * as settingsApi from '../services/settingsApi';

function SettingsPage() {
    const [activeTab, setActiveTab] = useState('panel');
    const [activeFileType, setActiveFileType] = useState('json');
    const [activeFile, setActiveFile] = useState('whitelist.json');
    const [editableFiles, setEditableFiles] = useState({
        json: ['bans.json', 'permissions.json', 'whitelist.json'],
        text: ['server.properties', 'eula.txt']
    });

    useEffect(() => {
        const loadEditableFiles = async () => {
            try {
                const files = await settingsApi.getEditableFiles();
                if (files?.json?.length || files?.text?.length) {
                    setEditableFiles(files);
                    if (files.json?.length) {
                        setActiveFileType('json');
                        setActiveFile(files.json[0]);
                    } else if (files.text?.length) {
                        setActiveFileType('text');
                        setActiveFile(files.text[0]);
                    }
                }
            } catch {
                // Keep defaults if endpoint fails.
            }
        };

        loadEditableFiles();
    }, []);

    const handleFileTypeChange = (nextType) => {
        setActiveFileType(nextType);
        const files = editableFiles[nextType] || [];
        if (files.length) {
            setActiveFile(files[0]);
        }
    };

    return (
        <div className="fade-in">
            <h1 className="page-title">Settings</h1>

            <div className="tabs">
                <button
                    className={`tab-btn ${activeTab === 'panel' ? 'active' : ''}`}
                    onClick={() => setActiveTab('panel')}
                >
                    Panel Configuration
                </button>
                <button
                    className={`tab-btn ${activeTab === 'server' ? 'active' : ''}`}
                    onClick={() => setActiveTab('server')}
                >
                    Server Configuration
                </button>
                <button
                    className={`tab-btn ${activeTab === 'providers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('providers')}
                >
                    Provider APIs
                </button>
                <button
                    className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
                    onClick={() => setActiveTab('files')}
                >
                    Configuration Files
                </button>
                <button
                    className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suggestions')}
                >
                    Suggestions
                </button>
            </div>

            <div className="tab-content" style={{ marginTop: '1rem' }}>
                {activeTab === 'panel' && <PanelSettingsForm />}
                {activeTab === 'server' && <ServerSettingsForm />}
                {activeTab === 'providers' && (
                    <div style={{ display: 'grid', gap: '16px' }}>
                        <ProviderApiSettingsForm />
                        <ProviderSourcesSettingsForm />
                    </div>
                )}
                {activeTab === 'files' && (
                    <div className="fade-in">
                        <div style={{ marginBottom: '1rem', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <label style={{ display: 'inline-block' }}>File Type:</label>
                            <select
                                value={activeFileType}
                                onChange={(e) => handleFileTypeChange(e.target.value)}
                                className="input-field"
                                style={{ width: 'auto', display: 'inline-block' }}
                            >
                                <option value="json">JSON Files</option>
                                <option value="text">Server Text Files</option>
                            </select>

                            <label style={{ display: 'inline-block', marginLeft: '8px' }}>Select File:</label>
                            <select
                                value={activeFile}
                                onChange={(e) => setActiveFile(e.target.value)}
                                className="input-field"
                                style={{ width: 'auto', display: 'inline-block' }}
                            >
                                {(editableFiles[activeFileType] || []).map((file) => (
                                    <option key={file} value={file}>{file}</option>
                                ))}
                            </select>
                        </div>
                        {activeFileType === 'json' ? (
                            <JsonFileEditor filename={activeFile} />
                        ) : (
                            <TextFileEditor filename={activeFile} />
                        )}
                    </div>
                )}
                {activeTab === 'suggestions' && <SuggestionSettingsForm />}
            </div>

            <style>{`
        .tabs {
          display: flex;
          gap: 1rem;
          border-bottom: 2px solid var(--border-color);
          margin-bottom: 1.5rem;
        }
        .tab-btn {
          background: none;
          border: none;
          color: var(--text-secondary);
          padding: 0.75rem 1.5rem;
          cursor: pointer;
          font-weight: 500;
          font-size: 1rem;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: var(--text-primary);
        }
        .tab-btn.active {
          color: var(--accent-color);
          border-bottom-color: var(--accent-color);
        }
      `}</style>
        </div>
    );
}

export default SettingsPage;
