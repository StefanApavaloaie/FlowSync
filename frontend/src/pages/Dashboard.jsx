import { useAuth } from "../context/AuthContext";

function Dashboard() {
    const { user, logout } = useAuth();

    return (
        <div
            style={{
                padding: "2rem",
                fontFamily: "system-ui",
            }}
        >
            <header
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "2rem",
                }}
            >
                <h1>FlowSync Dashboard</h1>
                <div>
                    {user && (
                        <span style={{ marginRight: "1rem" }}>
                            Signed in as <strong>{user.display_name || user.email}</strong>
                        </span>
                    )}
                    <button
                        onClick={logout}
                        style={{
                            padding: "0.4rem 0.8rem",
                            borderRadius: "6px",
                            border: "1px solid #ccc",
                            cursor: "pointer",
                        }}
                    >
                        Logout
                    </button>
                </div>
            </header>

            <p>
                This is your starting point. Next steps: list projects, upload assets,
                add real-time comments, and integrate AI suggestions.
            </p>
        </div>
    );
}

export default Dashboard;
