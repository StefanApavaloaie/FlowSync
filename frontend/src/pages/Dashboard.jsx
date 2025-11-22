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
    const scrollToMyProjects = () => {
        const el = document.getElementById("fs-my-projects-section");
        if (el) {
            el.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }
    };
    return (
        <div className="fs-app-shell">
            <header className="fs-header">
                <div className="fs-header-left">
                    <div className="fs-logo-circle">F</div>
                    <div>
                        <div className="fs-header-title-main">FlowSync</div>
                        <div className="fs-header-title-sub">
                            Real-time collaboration workspace
                        </div>
                    </div>
                </div>

                <div className="fs-header-right">
                    <InvitesBell onChanged={handleInvitesChanged} />

                    <div className="fs-header-user">
                        <span className="fs-header-user-name">
                            {user?.display_name || user?.email || "User"}
                        </span>
                        <span className="fs-header-user-email">
                            {user?.email}
                        </span>
                    </div>

                    <button onClick={logout} className="fs-button-ghost">
                        Log out
                    </button>
                </div>
            </header>

            <main className="fs-main-shell">
                <section className="fs-hero">
                    <div className="fs-hero-eyebrow">Design Collaboration Platform</div>
                    <h1 className="fs-hero-title">Multiplayer feedback for your design files or documents</h1>
                    <p className="fs-hero-subtitle">
                        Collaborate seamlessly with your team, manage projects efficiently, and streamline your design workflow. Upload files, collect comments, and keep everything in one shared space.
                    </p>
                    <div className="fs-hero-actions">
                        <button className="fs-button-ghost" style={{ padding: '0.8rem 1.6rem' }} onClick={scrollToMyProjects}>
                            📂 Jump to my projects
                        </button>
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', fontSize: '0.85rem', color: 'var(--fs-text-muted)' }}>
                        <div>📁 <strong>0</strong> active projects</div>
                        <div>🖼 <strong>0</strong> uploaded assets</div>
                        <div>💬 <strong>0</strong> comments in view</div>
                    </div>
                </section>

                <ProjectsSection refreshKey={projectsRefreshKey} />
            </main>
        </div>
    );
}

export default Dashboard;
