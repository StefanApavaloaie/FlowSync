import React from "react";

export default function ActivityLogModal({
    activityProject,
    loadingActivity,
    activityItems,
    closeActivityLog,
}) {
    if (!activityProject) return null;

    return (
        <div
            onClick={closeActivityLog}
            style={{
                position: "fixed",
                inset: 0,
                background:
                    "radial-gradient(circle at top, rgba(37,99,235,0.25), transparent 55%), rgba(0,0,0,0.7)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 50,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(480px, 90vw)",
                    maxHeight: "70vh",
                    background:
                        "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.96))",
                    borderRadius: "16px",
                    padding: "0.9rem",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.9)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    border: "1px solid rgba(30,64,175,0.8)",
                    color: "#e5e7eb",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                    }}
                >
                    <h3
                        style={{
                            margin: 0,
                            fontSize: "1rem",
                        }}
                    >
                        Activity – {activityProject.name}
                    </h3>
                    <button
                        onClick={closeActivityLog}
                        style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                            color: "#9ca3af",
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div
                    style={{
                        fontSize: "0.8rem",
                        color: "#9ca3af",
                    }}
                >
                    Recent actions in this project.
                </div>

                <div
                    style={{
                        flexGrow: 1,
                        overflowY: "auto",
                        marginTop: "0.25rem",
                        paddingRight: "0.25rem",
                    }}
                >
                    {loadingActivity ? (
                        <p
                            style={{
                                margin: 0,
                                fontSize: "0.85rem",
                            }}
                        >
                            Loading activity...
                        </p>
                    ) : activityItems.length === 0 ? (
                        <p
                            style={{
                                margin: 0,
                                fontSize: "0.85rem",
                            }}
                        >
                            No activity yet.
                        </p>
                    ) : (
                        activityItems.map((a) => {
                            const when = new Date(a.created_at).toLocaleString();
                            return (
                                <div
                                    key={a.id}
                                    style={{
                                        padding: "0.35rem 0",
                                        borderBottom:
                                            "1px solid rgba(31,41,55,0.9)",
                                        fontSize: "0.82rem",
                                    }}
                                >
                                    <div>{a.message}</div>
                                    <div
                                        style={{
                                            fontSize: "0.7rem",
                                            color: "#9ca3af",
                                            marginTop: "0.1rem",
                                        }}
                                    >
                                        {when}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
