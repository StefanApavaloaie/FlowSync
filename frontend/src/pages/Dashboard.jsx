// frontend/src/pages/Dashboard.jsx

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import ProjectsSection from "../components/ProjectsSection";
import InvitesBell from "../components/InvitesBell";

function Dashboard() {
    const { user, logout } = useAuth();
    const [projectsRefreshKey, setProjectsRefreshKey] = useState(0);

    const handleInvitesChanged = () => {
        setProjectsRefreshKey((prev) => prev + 1);
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "#f3f4f6",
                fontFamily: "system-ui",
            }}
        >
            <header
                style={{
                    padding: "0.9rem 1.5rem",
                    borderBottom: "1px solid #e5e7eb",
                    backgroundColor: "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                }}
            >
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                        style={{
                            fontSize: "1.1rem",
                            fontWeight: 600,
                        }}
                    >
                        FlowSync
                    </span>
                    <span
                        style={{
                            fontSize: "0.8rem",
                            color: "#6b7280",
                        }}
                    >
                        Collaborative design feedback
                    </span>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                    }}
                >
                    <InvitesBell onChanged={handleInvitesChanged} />

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                        }}
                    >
                        <span
                            style={{
                                fontSize: "0.9rem",
                                fontWeight: 500,
                            }}
                        >
                            {user?.display_name || user?.email || "User"}
                        </span>
                        <span
                            style={{
                                fontSize: "0.75rem",
                                color: "#6b7280",
                            }}
                        >
                            {user?.email}
                        </span>
                    </div>

                    <button
                        onClick={logout}
                        style={{
                            padding: "0.35rem 0.8rem",
                            borderRadius: "6px",
                            border: "1px solid #e5e7eb",
                            backgroundColor: "#f9fafb",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                        }}
                    >
                        Log out
                    </button>
                </div>
            </header>

            <main style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
                <ProjectsSection refreshKey={projectsRefreshKey} />
            </main>
        </div>
    );
}

export default Dashboard;
