import { useState, useEffect, useCallback, useRef } from 'react';
import { fileAPI } from '../services/api';
import { useDialog } from '../contexts/DialogContext';
import {
    Folder, File as FileIcon, ArrowLeft, RefreshCw,
    Plus, Trash2, Upload, X, Save, FileText, ChevronRight, ChevronDown
} from 'lucide-react';
import '../styles/global.css';

function FilesPage() {
    const dialog = useDialog();
    const [files, setFiles] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Editor State
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingFile, setEditingFile] = useState(null); // { name, path }
    const [editorContent, setEditorContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [exportModal, setExportModal] = useState({ open: false, state: 'loading', message: '' });
    const [exportPicker, setExportPicker] = useState({
        open: false,
        loading: false,
        loadingPath: '',
        tree: {},
        expanded: {},
        selected: {}
    });
    const exportTreeRef = useRef(null);
    const updateExportPickerPreserveScroll = (updater) => {
        const currentScrollTop = exportTreeRef.current ? exportTreeRef.current.scrollTop : 0;
        setExportPicker(updater);
        requestAnimationFrame(() => {
            if (exportTreeRef.current) {
                exportTreeRef.current.scrollTop = currentScrollTop;
            }
        });
    };

    const loadFiles = useCallback(async (path) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fileAPI.list(path);
            const data = response.data;
            const sorted = data.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) {
                    return a.name.localeCompare(b.name);
                }
                return a.isDirectory ? -1 : 1;
            });
            setFiles(sorted);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFiles(currentPath);
    }, [currentPath, loadFiles]);

    const handleNavigate = (folderName) => {
        const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
        setCurrentPath(newPath);
    };

    const handleBack = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const handleCreateFolder = async () => {
        const name = await dialog.showPrompt("Enter folder name:", "New Folder", "Create Folder");
        if (!name) return;
        try {
            const path = currentPath ? `${currentPath}/${name}` : name;
            await fileAPI.createDirectory(path);
            loadFiles(currentPath);
        } catch (err) {
            dialog.showAlert("Failed to create folder: " + (err.response?.data?.error || err.message), "Error");
        }
    };

    const handleCreateFile = async () => {
        const name = await dialog.showPrompt("Enter file name (e.g. notes.txt):", "new-file.txt", "Create File");
        if (!name) return;
        try {
            const path = currentPath ? `${currentPath}/${name}` : name;
            await fileAPI.write(path, ""); // Empty file
            loadFiles(currentPath);
            // Optionally open editor immediately
            handleEditFile(name);
        } catch (err) {
            dialog.showAlert("Failed to create file: " + (err.response?.data?.error || err.message), "Error");
        }
    };

    const handleDelete = async (fileName) => {
        const confirmed = await dialog.showConfirm(`Are you sure you want to delete '${fileName}'? This cannot be undone.`, "Delete File");
        if (!confirmed) return;
        try {
            const path = currentPath ? `${currentPath}/${fileName}` : fileName;
            await fileAPI.delete(path);
            loadFiles(currentPath);
        } catch (err) {
            dialog.showAlert("Failed to delete: " + (err.response?.data?.error || err.message), "Error");
        }
    };

    const handleEditFile = async (fileName) => {
        try {
            const path = currentPath ? `${currentPath}/${fileName}` : fileName;
            const response = await fileAPI.read(path);
            setEditingFile({ name: fileName, path });
            setEditorContent(response.data.content);
            setEditorOpen(true);
        } catch (err) {
            dialog.showAlert("Failed to read file: " + (err.response?.data?.error || err.message), "Error");
        }
    };

    const handleSaveFile = async () => {
        if (!editingFile) return;
        setSaving(true);
        try {
            await fileAPI.write(editingFile.path, editorContent);
            setEditorOpen(false);
            setEditingFile(null);
            loadFiles(currentPath);
        } catch (err) {
            dialog.showAlert("Failed to save: " + (err.response?.data?.error || err.message), "Error");
        } finally {
            setSaving(false);
        }
    };

    const downloadBlob = (blob, fileName) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const loadExportDirectory = async (directory = '', keepSelection = true) => {
        const currentScrollTop = exportTreeRef.current ? exportTreeRef.current.scrollTop : 0;
        setExportPicker((prev) => ({
            ...prev,
            open: true,
            loading: prev.tree[directory] ? prev.loading : true,
            loadingPath: directory
        }));
        try {
            const response = await fileAPI.list(directory, { timeout: 60000 });
            const dirItems = Array.isArray(response.data) ? response.data : [];
            setExportPicker((prev) => ({
                ...prev,
                open: true,
                loading: false,
                loadingPath: '',
                tree: {
                    ...prev.tree,
                    [directory]: dirItems
                },
                expanded: {
                    ...prev.expanded,
                    [directory]: true
                },
                selected: keepSelection ? prev.selected : {}
            }));
            requestAnimationFrame(() => {
                if (exportTreeRef.current) {
                    exportTreeRef.current.scrollTop = currentScrollTop;
                }
            });
        } catch (err) {
            setExportPicker({ open: false, loading: false, loadingPath: '', tree: {}, expanded: {}, selected: {} });
            dialog.showAlert(err.response?.data?.error || err.message || 'Failed to load export list', 'Export Error');
        }
    };

    const openExportPicker = async () => {
        setExportPicker({ open: true, loading: true, loadingPath: '', tree: {}, expanded: {}, selected: {} });
        try {
            const response = await fileAPI.list('', { timeout: 60000 });
            const rootItems = Array.isArray(response.data) ? response.data : [];
            setExportPicker({
                open: true,
                loading: false,
                loadingPath: '',
                tree: { '': rootItems },
                expanded: { '': true },
                selected: {}
            });
        } catch (err) {
            setExportPicker({ open: false, loading: false, loadingPath: '', tree: {}, expanded: {}, selected: {} });
            dialog.showAlert(err.response?.data?.error || err.message || 'Failed to load export list', 'Export Error');
        }
    };

    const handleExportZip = async () => {
        const includePaths = Object.keys(exportPicker.selected).filter((p) => exportPicker.selected[p]);
        if (includePaths.length === 0) {
            dialog.showAlert('Select at least one file or folder to export.', 'Export');
            return;
        }
        setExportPicker({ open: false, loading: false, loadingPath: '', tree: {}, expanded: {}, selected: {} });
        setExportModal({ open: true, state: 'loading', message: 'Exporting server.zip...' });
        try {
            const response = await fileAPI.exportZip(includePaths);
            downloadBlob(response.data, 'server-exported.zip');
            setExportModal({ open: true, state: 'success', message: 'Server ZIP export completed successfully.' });
        } catch (err) {
            setExportModal({ open: false, state: 'loading', message: '' });
            dialog.showAlert(err.response?.data?.error || err.message || 'Failed to export ZIP', 'Export Error');
        }
    };

    // Drag & Drop Handlers
    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const toggleFolderExpand = async (relPath) => {
        const isExpanded = Boolean(exportPicker.expanded[relPath]);
        if (isExpanded) {
            updateExportPickerPreserveScroll((prev) => ({
                ...prev,
                expanded: {
                    ...prev.expanded,
                    [relPath]: false
                }
            }));
            return;
        }
        if (!exportPicker.tree[relPath]) {
            await loadExportDirectory(relPath);
        } else {
            updateExportPickerPreserveScroll((prev) => ({
                ...prev,
                expanded: {
                    ...prev.expanded,
                    [relPath]: true
                }
            }));
        }
    };

    const getDescendantKeysFromSelected = (basePath, treeState) => {
        const keys = [];
        const prefix = `${basePath}/`;
        Object.keys(treeState || {}).forEach((dirKey) => {
            if (!dirKey.startsWith(prefix)) return;
            const items = treeState[dirKey] || [];
            items.forEach((item) => {
                const p = dirKey ? `${dirKey}/${item.name}` : item.name;
                keys.push(p);
            });
        });
        return keys;
    };

    const hasSelectedAncestor = (relPath, selectedMap) => {
        const parts = String(relPath || '').split('/').filter(Boolean);
        let curr = '';
        for (let i = 0; i < parts.length - 1; i += 1) {
            curr = curr ? `${curr}/${parts[i]}` : parts[i];
            if (selectedMap[curr]) return true;
        }
        return false;
    };

    const isPathChecked = (relPath, selectedMap) => {
        if (selectedMap[relPath]) return true;
        return hasSelectedAncestor(relPath, selectedMap);
    };

    const setPathSelection = (relPath, isDirectory, checked) => {
        updateExportPickerPreserveScroll((prev) => {
            const nextSelected = { ...prev.selected, [relPath]: checked };
            if (isDirectory) {
                const descendants = getDescendantKeysFromSelected(relPath, prev.tree);
                descendants.forEach((childPath) => {
                    nextSelected[childPath] = checked;
                });
            } else if (!checked) {
                nextSelected[relPath] = false;
            }
            return {
                ...prev,
                selected: nextSelected
            };
        });
    };

    const renderExportTree = (directory = '', depth = 0) => {
        const items = exportPicker.tree[directory] || [];
        return items.map((item) => {
            const relPath = directory ? `${directory}/${item.name}` : item.name;
            const isExpanded = Boolean(exportPicker.expanded[relPath]);
            return (
                <div key={relPath}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', paddingLeft: `${depth * 18 + 4}px` }}>
                        {item.isDirectory ? (
                            <button
                                type="button"
                                onClick={() => toggleFolderExpand(relPath)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                title={isExpanded ? 'Collapse folder' : 'Expand folder'}
                            >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <span style={{ width: 14, display: 'inline-block' }} />
                        )}
                        <input
                            type="checkbox"
                            checked={isPathChecked(relPath, exportPicker.selected)}
                            onChange={(e) => setPathSelection(relPath, item.isDirectory, e.target.checked)}
                        />
                        <span style={{ color: item.isDirectory ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {item.isDirectory ? '[Folder]' : '[File]'} {item.name}
                        </span>
                    </div>
                    {item.isDirectory && isExpanded && renderExportTree(relPath, depth + 1)}
                </div>
            );
        });
    };

    const onDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const onDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length === 0) return;

        setUploading(true);
        // Upload sequentially or parallel
        for (const file of droppedFiles) {
            try {
                const path = currentPath ? `${currentPath}/${file.name}` : file.name;
                await fileAPI.upload(path, file);
            } catch (err) {
                console.error("Upload failed for " + file.name, err);
                dialog.showAlert(`Failed to upload ${file.name}`, "Upload Error");
            }
        }
        setUploading(false);
        loadFiles(currentPath);
    };

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header / Toolbar */}
            <div className="dashboard-header" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
            }}>
                <div>
                    <h1 className="page-title">File Manager</h1>
                    <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Folder size={14} />
                        {currentPath ? currentPath.replace(/\//g, ' > ') : 'Root'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => loadFiles(currentPath)} className="btn btn-secondary" title="Refresh">
                        <RefreshCw size={18} />
                    </button>
                    {currentPath && (
                        <button onClick={handleBack} className="btn btn-secondary">
                            <ArrowLeft size={18} style={{ marginRight: '5px' }} /> Back
                        </button>
                    )}
                    <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 8px' }}></div>
                    <button onClick={handleCreateFolder} className="btn btn-secondary">
                        <Plus size={18} style={{ marginRight: '5px' }} /> Folder
                    </button>
                    <button onClick={handleCreateFile} className="btn btn-secondary">
                        <FileText size={18} style={{ marginRight: '5px' }} /> File
                    </button>
                    <button onClick={openExportPicker} className="btn btn-secondary">
                        Export Server ZIP
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && <div className="status-badge status-offline" style={{ marginBottom: '1rem', display: 'block' }}>{error}</div>}

            {/* Main Content Area (Drop Zone) */}
            <div
                className="card"
                style={{
                    flex: 1,
                    padding: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: isDragging ? '2px dashed var(--accent-green)' : '1px solid var(--border-color)',
                    position: 'relative'
                }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                {/* Columns Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '40px 1fr 100px',
                    gap: '1rem',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-tertiary)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    textTransform: 'uppercase'
                }}>
                    <span>Type</span>
                    <span>Name</span>
                    <span style={{ textAlign: 'right' }}>Actions</span>
                </div>

                {/* File List */}
                <div className="file-list" style={{ overflowY: 'auto', flex: 1 }}>
                    {loading || uploading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {uploading ? 'Uploading files...' : 'Loading...'}
                        </div>
                    ) : files.length === 0 ? (
                        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Upload size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>Empty Directory</p>
                            <p style={{ fontSize: '0.9em' }}>Drag files here to upload</p>
                        </div>
                    ) : (
                        files.map((file) => (
                            <div
                                key={file.name}
                                className="file-row"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '40px 1fr 100px',
                                    gap: '1rem',
                                    padding: '12px 20px',
                                    borderBottom: '1px solid var(--border-color)',
                                    alignItems: 'center',
                                    cursor: file.isDirectory ? 'pointer' : 'default',
                                    transition: 'background 0.2s'
                                }}
                                onClick={() => file.isDirectory ? handleNavigate(file.name) : handleEditFile(file.name)}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <div style={{ color: file.isDirectory ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>
                                    {file.isDirectory ? <Folder size={20} /> : <FileIcon size={20} />}
                                </div>
                                <div style={{ fontWeight: 500 }}>
                                    {file.name}
                                </div>
                                <div style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                        className="btn-icon danger"
                                        onClick={() => handleDelete(file.name)}
                                        title="Delete"
                                        style={{ padding: '4px', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Drop Overlay */}
                {isDragging && (
                    <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 10, pointerEvents: 'none'
                    }}>
                        <div style={{ textAlign: 'center', color: 'white' }}>
                            <Upload size={48} />
                            <h2>Drop files to upload</h2>
                        </div>
                    </div>
                )}
            </div>

            {/* Editor Overlay */}
            {editorOpen && (
                <div className="modal-overlay" style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '2rem'
                }}>
                    <div className="card" style={{
                        width: '100%', maxWidth: '900px', height: '80vh',
                        display: 'flex', flexDirection: 'column', padding: 0,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{
                            padding: '1rem', borderBottom: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--bg-tertiary)'
                        }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText size={18} />
                                {editingFile?.name}
                            </h3>
                            <button onClick={() => setEditorOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ flex: 1, position: 'relative' }}>
                            <textarea
                                value={editorContent}
                                onChange={(e) => setEditorContent(e.target.value)}
                                style={{
                                    width: '100%', height: '100%',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    border: 'none', padding: '1rem',
                                    fontFamily: 'monospace', fontSize: '14px',
                                    resize: 'none', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{
                            padding: '1rem', borderTop: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'flex-end', gap: '1rem',
                            background: 'var(--bg-secondary)'
                        }}>
                            <button className="btn btn-secondary" onClick={() => setEditorOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveFile} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'} <Save size={16} style={{ marginLeft: '5px' }} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {exportPicker.open && (
                <div className="modal-overlay" style={{
                    position: 'fixed', inset: 0, zIndex: 2050,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ marginTop: 0 }}>Export Server ZIP</h3>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
                            Choose files/folders to include. You can open folders (including world) and select nested items.
                        </p>
                        <div ref={exportTreeRef} style={{ overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', minHeight: '180px' }}>
                            {exportPicker.loading ? (
                                <div style={{ color: 'var(--text-secondary)' }}>Loading export list...</div>
                            ) : (exportPicker.tree[''] || []).length === 0 ? (
                                <div style={{ color: 'var(--text-secondary)' }}>No files found in root.</div>
                            ) : (
                                renderExportTree('', 0)
                            )}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                            Selected: {Object.keys(exportPicker.selected).filter((p) => exportPicker.selected[p]).length}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                            <button className="btn btn-secondary" onClick={() => setExportPicker({ open: false, loading: false, loadingPath: '', tree: {}, expanded: {}, selected: {} })}>
                                Close
                            </button>
                            <button className="btn btn-primary" style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }} onClick={handleExportZip}>
                                Export
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {exportModal.open && (
                <div className="modal-overlay" style={{
                    position: 'fixed', inset: 0, zIndex: 2100,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="card" style={{ maxWidth: 420, width: '100%', padding: '22px' }}>
                        {exportModal.state === 'loading' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', minHeight: '140px' }}>
                                <img
                                    src="/static/images/loading-spinner.svg"
                                    alt="Loading"
                                    style={{ width: 34, height: 34 }}
                                />
                                <div>
                                    <h3 style={{ margin: 0 }}>Export In Progress</h3>
                                    <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)' }}>{exportModal.message}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Export Complete</h3>
                                <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>{exportModal.message}</p>
                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <button className="btn btn-primary" onClick={() => setExportModal({ open: false, state: 'loading', message: '' })}>
                                        Close
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default FilesPage;
