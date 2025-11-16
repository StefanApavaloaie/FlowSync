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
        <div style={{ position: "relative" }}>
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                style={{
                    position: "relative",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: "0.25rem",
                }}
            >
                <span style={{ fontSize: "1.3rem" }}>🔔</span>
                {count > 0 && (
                    <span
                        style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            transform: "translate(50%, -50%)",
                            backgroundColor: "#ef4444",
                            color: "#fff",
                            borderRadius: "999px",
                            padding: "0 0.35rem",
                            fontSize: "0.7rem",
                            minWidth: "1.1rem",
                            textAlign: "center",
                        }}
                    >
                        {count}
                    </span>
                )}
            </button>

            {open && (
                <div
                    style={{
                        position: "absolute",
                        right: 0,
                        marginTop: "0.5rem",
                        width: "320px",
                        maxHeight: "360px",
                        overflowY: "auto",
                        backgroundColor: "#fff",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                        zIndex: 50,
                    }}
                >
                    <div
                        style={{
                            padding: "0.6rem 0.8rem",
                            borderBottom: "1px solid #e5e7eb",
                            fontWeight: 600,
                            fontSize: "0.9rem",
                        }}
                    >
                        Invites
                    </div>

                    {loading ? (
                        <div
                            style={{
                                padding: "0.8rem",
                                fontSize: "0.85rem",
                                color: "#6b7280",
                            }}
                        >
                            Loading...
                        </div>
                    ) : invites.length === 0 ? (
                        <div
                            style={{
                                padding: "0.8rem",
                                fontSize: "0.85rem",
                                color: "#6b7280",
                            }}
                        >
                            No pending invites.
                        </div>
                    ) : (
                        invites.map((inv) => (
                            <div
                                key={inv.id}
                                style={{
                                    padding: "0.7rem 0.8rem",
                                    borderBottom: "1px solid #f3f4f6",
                                    fontSize: "0.85rem",
                                }}
                            >
                                <div style={{ fontWeight: 500 }}>
                                    {inv.project?.name || "Project"}
                                </div>
                                <div
                                    style={{
                                        color: "#6b7280",
                                        fontSize: "0.8rem",
                                        marginTop: "0.15rem",
                                    }}
                                >
                                    Invited by{" "}
                                    {inv.invited_by?.display_name ||
                                        inv.invited_by?.email ||
                                        "unknown"}
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "flex-end",
                                        gap: "0.35rem",
                                        marginTop: "0.45rem",
                                    }}
                                >
                                    <button
                                        onClick={() => handleDecline(inv.id)}
                                        style={{
                                            borderRadius: "4px",
                                            border: "1px solid #e5e7eb",
                                            backgroundColor: "#f9fafb",
                                            padding: "0.25rem 0.55rem",
                                            fontSize: "0.8rem",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Decline
                                    </button>
                                    <button
                                        onClick={() => handleAccept(inv.id)}
                                        style={{
                                            borderRadius: "4px",
                                            border: "none",
                                            backgroundColor: "#111827",
                                            color: "#fff",
                                            padding: "0.25rem 0.7rem",
                                            fontSize: "0.8rem",
                                            cursor: "pointer",
                                        }}
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
