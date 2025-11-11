import { useAuth } from "../context/AuthContext";
import ProjectsSection from "../components/ProjectsSection";

function Dashboard() {
    const { user, logout } = useAuth();

    return (
        <div
            style={{
                padding: "2rem",
                fontFamily: "system-ui",
                minHeight: "100vh",
                backgroundColor: "#fafafa",
            }}
        >
            <header
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "1.5rem",
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: "1.6rem",
                            margin: 0,
                        }}
                    >
                        FlowSync
                    </h1>
                    <p
                        style={{
                            margin: 0,
                            marginTop: "0.25rem",
                            color: "#666",
                            fontSize: "0.9rem",
                        }}
                    >
                        Collaborative design feedback workspace
                    </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {user && (
                        <span
                            style={{
                                fontSize: "0.9rem",
                                color: "#444",
                            }}
                        >
                            Signed in as{" "}
                            <strong>{user.display_name || user.email}</strong>
                        </span>
                    )}
                    <button
                        onClick={logout}
                        style={{
                            padding: "0.4rem 0.9rem",
                            borderRadius: "6px",
                            border: "1px solid #ccc",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            backgroundColor: "#fff",
                        }}
                    >
                        Logout
                    </button>
                </div>
            </header>

            <main>
                <ProjectsSection />
            </main>
        </div>
    );
}

export default Dashboard;
