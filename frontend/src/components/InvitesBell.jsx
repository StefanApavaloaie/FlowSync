import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

function InvitesBell({ onChanged }) {
    const { token } = useAuth();
    const [invites, setInvites] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchInvites = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await api.get("/invites/pending", {
                headers: { Authorization: `Bearer ${token}` },
            });
            setInvites(res.data);
        } catch (err) {
            console.error("Failed to load invites", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvites();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const handleAccept = async (inviteId) => {
        try {
            await api.post(`/invites/${inviteId}/accept`, null, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchInvites();
            if (onChanged) onChanged();
        } catch (err) {
            console.error("Failed to accept invite", err);
            alert("Failed to accept invite.");
        }
    };

    const handleDecline = async (inviteId) => {
        try {
            await api.post(`/invites/${inviteId}/decline`, null, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchInvites();
            if (onChanged) onChanged();
        } catch (err) {
            console.error("Failed to decline invite", err);
            alert("Failed to decline invite.");
        }
    };

    const count = invites.length;

    return (
        <div className="fs-invites-wrapper">
            {/* bell button */}
            <button
                type="button"
                className="fs-bell-button"
                onClick={() => setOpen((prev) => !prev)}
            >
                <span className="fs-bell-icon">🔔</span>
                {count > 0 && (
                    <span className="fs-bell-badge">
                        {count}
                    </span>
                )}
            </button>

            {/* dropdown */}
            {open && (
                <div className="fs-dropdown-card fs-invites-dropdown">
                    <div className="fs-invites-header">
                        <span>Invites</span>
                        {count > 0 && (
                            <span className="fs-invites-count">
                                {count} pending
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="fs-invites-empty">
                            Loading...
                        </div>
                    ) : invites.length === 0 ? (
                        <div className="fs-invites-empty">
                            No pending invites.
                        </div>
                    ) : (
                        invites.map((inv) => (
                            <div key={inv.id} className="fs-invite-item">
                                <div className="fs-invite-main">
                                    <div className="fs-invite-project">
                                        {inv.project?.name || "Project"}
                                    </div>
                                    <div className="fs-invite-meta">
                                        Invited by{" "}
                                        {inv.invited_by?.display_name ||
                                            inv.invited_by?.email ||
                                            "unknown"}
                                    </div>
                                </div>
                                <div className="fs-invite-actions">
                                    <button
                                        type="button"
                                        className="fs-invite-btn fs-invite-decline"
                                        onClick={() => handleDecline(inv.id)}
                                    >
                                        Decline
                                    </button>
                                    <button
                                        type="button"
                                        className="fs-invite-btn fs-invite-accept"
                                        onClick={() => handleAccept(inv.id)}
                                    >
                                        Accept
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default InvitesBell;
