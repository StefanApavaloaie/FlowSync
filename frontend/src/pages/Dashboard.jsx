import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ProjectsSection from "../components/ProjectsSection";
import InvitesBell from "../components/InvitesBell";
import DarkVeil from "../components/imports/DarkVeil";
import { useNavigate } from "react-router-dom";
function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [projectsRefreshKey, setProjectsRefreshKey] = useState(0);

    // 👇 treat "logged in" as: has display_name or email
    const isLoggedIn = !!(user?.display_name || user?.email);

    // modal state
    const [showLoginModal, setShowLoginModal] = useState(!isLoggedIn);

    useEffect(() => {
        // whenever user changes, update modal
        setShowLoginModal(!isLoggedIn);
    }, [isLoggedIn]);

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
        <>
            <DarkVeil />

            {/* 🔔 login modal when user is not logged in */}
            {showLoginModal && (
                <div className="fs-modal-backdrop">
                    <div className="fs-modal">
                        <h2>You are not logged in</h2>
                        <p>Log in to see your projects 😊</p>

                        <div className="fs-modal-actions">
                            <button
                                className="fs-modal-primary"
                                onClick={() => {
                                    logout();
                                    navigate("/");
                                }
                                }
                            >
                                Go to login
                            </button>

                            <button
                                className="fs-modal-secondary"
                                onClick={() => setShowLoginModal(false)}
                            >
                                Maybe later
                            </button>
                        </div>
                    </div>
                </div>
            )}


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

                        {/* only show Log out when we actually have a user */}
                        {isLoggedIn && (
                            <button
                                onClick={logout}
                                className="fs-button-ghost"
                            >
                                Log out
                            </button>
                        )}
                    </div>
                </header>

                <main className="fs-main-shell">
                    <section className="fs-hero">
                        <div className="fs-hero-eyebrow">
                            Design Collaboration Platform
                        </div>
                        <h1 className="fs-hero-title">
                            Multiplayer feedback for your design files or
                            documents
                        </h1>
                        <p className="fs-hero-subtitle">
                            Collaborate seamlessly with your team, manage
                            projects efficiently, and streamline your design
                            workflow. Upload files, collect comments, and keep
                            everything in one shared space.
                        </p>
                        <div className="fs-hero-actions">
                            <button
                                className="fs-button-ghost"
                                style={{ padding: "0.8rem 1.6rem" }}
                                onClick={scrollToMyProjects}
                            >
                                📂 Jump to my projects
                            </button>
                        </div>
                        <div
                            style={{
                                marginTop: "1rem",
                                display: "flex",
                                gap: "2rem",
                                fontSize: "0.85rem",
                                color: "var(--fs-text-muted)",
                            }}
                        >
                        </div>
                    </section>

                    <ProjectsSection refreshKey={projectsRefreshKey} />
                </main>
            </div>
        </>
    );
}

export default Dashboard;
