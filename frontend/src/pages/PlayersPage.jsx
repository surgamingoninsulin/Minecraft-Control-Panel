import { useState, useEffect } from 'react';
import { playerAPI } from '../services/api';
import { useDialog } from '../contexts/DialogContext';
import { Users, ChevronRight, User, Clock, Trash2 } from 'lucide-react';
import '../styles/global.css';

function PlayersPage() {
    const dialog = useDialog();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [addingPlayer, setAddingPlayer] = useState(false);
    const [busyPlayerAction, setBusyPlayerAction] = useState('');

    useEffect(() => {
        loadPlayers();
    }, []);

    const loadPlayers = async () => {
        setLoading(true);
        try {
            const response = await playerAPI.list();
            const list = Array.isArray(response.data) ? response.data : [];
            setPlayers(list);

            if (selectedPlayer) {
                const refreshed = list.find((p) => p.uuid === selectedPlayer.uuid);
                if (refreshed) {
                    setSelectedPlayer(refreshed);
                } else {
                    setSelectedPlayer(null);
                }
            }
        } catch (err) {
            console.error('Failed to load players:', err);
            dialog.showAlert('Failed to load players list');
        } finally {
            setLoading(false);
        }
    };

    const handleRemovePlayer = async (player) => {
        const key = `rm:${player.uuid}`;
        const confirmed = await dialog.showConfirm(
            `Remove player "${player.name}" from player records? This removes entries from ops.json, whitelist.json, and usercache.json.`,
            'Remove Player'
        );
        if (!confirmed) return;

        setBusyPlayerAction(key);
        try {
            try {
                await playerAPI.remove(player.uuid);
            } catch (primaryErr) {
                if (primaryErr?.response?.status !== 404) {
                    throw primaryErr;
                }
                await playerAPI.delete(player.uuid);
            }
            if (selectedPlayer?.uuid === player.uuid) {
                setSelectedPlayer(null);
            }
            await loadPlayers();
            dialog.showAlert(`Removed player "${player.name}".`, 'Success');
        } catch (err) {
            dialog.showAlert('Failed to remove player: ' + (err.response?.data?.error || err.message));
        } finally {
            setBusyPlayerAction('');
        }
    };

    const handleSelectPlayer = async (uuid) => {
        try {
            const response = await playerAPI.get(uuid);
            setSelectedPlayer(response.data);
        } catch {
            const fallback = players.find((p) => p.uuid === uuid);
            if (fallback) setSelectedPlayer(fallback);
        }
    };

    const handleToggleOpInList = async (player) => {
        const key = `op:${player.uuid}`;
        setBusyPlayerAction(key);
        try {
            await playerAPI.setOp(player.uuid, !player.isOp, player.name);
            await loadPlayers();
            if (selectedPlayer?.uuid === player.uuid) {
                await handleSelectPlayer(player.uuid);
            }
        } catch (err) {
            dialog.showAlert('Failed to update operator status: ' + (err.response?.data?.error || err.message));
        } finally {
            setBusyPlayerAction('');
        }
    };

    const handleToggleWhitelistInList = async (player) => {
        const key = `wl:${player.uuid}`;
        setBusyPlayerAction(key);
        try {
            await playerAPI.setWhitelist(player.uuid, !player.isWhitelisted, player.name);
            await loadPlayers();
            if (selectedPlayer?.uuid === player.uuid) {
                await handleSelectPlayer(player.uuid);
            }
        } catch (err) {
            dialog.showAlert('Failed to update whitelist status: ' + (err.response?.data?.error || err.message));
        } finally {
            setBusyPlayerAction('');
        }
    };

    const handleAddPlayer = async () => {
        const name = String(newPlayerName || '').trim();
        if (!name) {
            dialog.showAlert('Enter a player name first.');
            return;
        }

        setAddingPlayer(true);
        try {
            const response = await playerAPI.add(name);
            setNewPlayerName('');
            await loadPlayers();
            if (response?.data?.uuid) {
                await handleSelectPlayer(response.data.uuid);
            }
        } catch (err) {
            dialog.showAlert('Failed to add player: ' + (err.response?.data?.error || err.message));
        } finally {
            setAddingPlayer(false);
        }
    };

    const getPlayerHeadUrl = (player) => {
        const nameOrUuid = encodeURIComponent(String(player?.name || player?.uuid || 'Steve'));
        return `https://mc-heads.net/avatar/${nameOrUuid}/40`;
    };

    const formatLastSeen = (value) => {
        if (!value) return 'Unknown';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleString();
    };

    if (loading) return <div className="page-loading">Loading players...</div>;

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="dashboard-header">
                <div>
                    <h1 className="page-title">Player Management</h1>
                    <p className="page-subtitle">Minecraft players from whitelist, ops, and usercache</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', flex: 1, overflow: 'hidden' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={18} />
                        <strong>Players ({players.length})</strong>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {players.map((p) => (
                            <div
                                key={p.uuid}
                                onClick={() => handleSelectPlayer(p.uuid)}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    background: selectedPlayer?.uuid === p.uuid ? 'var(--bg-secondary)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <img
                                            src={getPlayerHeadUrl(p)}
                                            alt={p.name}
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '6px',
                                                imageRendering: 'pixelated',
                                                border: '1px solid var(--border-color)',
                                                background: 'rgba(255,255,255,0.04)'
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div>
                                            <div style={{ fontWeight: '600' }}>{p.name}</div>
                                            <small style={{ color: 'var(--text-muted)' }}>{p.uuid}</small>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        className="btn btn-danger"
                                        type="button"
                                        title="Remove player from records"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemovePlayer(p);
                                        }}
                                        disabled={busyPlayerAction === `rm:${p.uuid}`}
                                        style={{ padding: '6px 8px' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <ChevronRight size={16} opacity={0.5} />
                                </div>
                            </div>
                        ))}
                        {players.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                No players found.
                            </div>
                        )}
                    </div>
                    <div style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddPlayer();
                                }
                            }}
                            placeholder="Player name"
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" onClick={handleAddPlayer} disabled={addingPlayer}>
                            {addingPlayer ? 'Adding...' : 'Add'}
                        </button>
                    </div>
                </div>

                <div className="card" style={{ padding: '24px', overflowY: 'auto' }}>
                    {!selectedPlayer ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <Users size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                            <p>Select a player to view details.</p>
                        </div>
                    ) : (
                        <div className="fade-in" style={{ display: 'grid', gap: '18px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <img
                                    src={getPlayerHeadUrl(selectedPlayer)}
                                    alt={selectedPlayer.name}
                                    style={{ width: '52px', height: '52px', borderRadius: '10px', imageRendering: 'pixelated', border: '1px solid var(--border-color)' }}
                                />
                                <div>
                                    <h2 style={{ margin: 0 }}>{selectedPlayer.name}</h2>
                                    <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedPlayer.uuid}</code>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="card" style={{ margin: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        <User size={14} /> Status
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <span className="status-badge" style={{ background: selectedPlayer.isOp ? '#60a5fa' : 'rgba(96,165,250,0.2)', color: selectedPlayer.isOp ? '#00162e' : '#93c5fd' }}>
                                            {selectedPlayer.isOp ? 'Operator' : 'Not OP'}
                                        </span>
                                        <span className="status-badge" style={{ background: selectedPlayer.isWhitelisted ? '#84cc16' : 'rgba(132,204,22,0.2)', color: selectedPlayer.isWhitelisted ? '#1d2a00' : '#a3e635' }}>
                                            {selectedPlayer.isWhitelisted ? 'Whitelisted' : 'Not Whitelisted'}
                                        </span>
                                    </div>
                                </div>
                                <div className="card" style={{ margin: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        <Clock size={14} /> Last Seen
                                    </div>
                                    <div>{formatLastSeen(selectedPlayer.lastSeen)}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-primary" onClick={() => handleToggleOpInList(selectedPlayer)} disabled={busyPlayerAction === `op:${selectedPlayer.uuid}`}>
                                    {selectedPlayer.isOp ? 'Remove OP' : 'Make OP'}
                                </button>
                                <button className="btn btn-primary" onClick={() => handleToggleWhitelistInList(selectedPlayer)} disabled={busyPlayerAction === `wl:${selectedPlayer.uuid}`}>
                                    {selectedPlayer.isWhitelisted ? 'Remove Whitelist' : 'Add Whitelist'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PlayersPage;
