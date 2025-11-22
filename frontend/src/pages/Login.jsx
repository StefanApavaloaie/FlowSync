import api from "../api/client";

function Login() {
    const handleGoogleSignIn = async () => {
        try {
            const res = await api.get("/auth/google/url");
            const url = res.data.url;
            if (!url) {
                console.error("No URL returned from backend");
                return;
            }
            window.location.href = url;
        } catch (err) {
            console.error("Failed to start Google login", err);
            alert("Failed to start Google login. Check backend logs.");
        }
    };

    return (
        <div className="fs-auth-wrapper">
            <div className="fs-auth-card">
                <div className="fs-logo-circle" style={{ margin: "0 auto 1.5rem", width: "60px", height: "60px", fontSize: "1.8rem" }}>F</div>
                <h1 className="fs-auth-title">Welcome to FlowSync</h1>
                <p className="fs-auth-subtitle">
                    Your central hub for design collaboration. Share files, collect feedback,
                    and streamline your creative workflow—all in one beautiful interface.
                </p>
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "1rem",
                    margin: "1.5rem 0",
                    fontSize: "0.8rem",
                    color: "rgba(191, 219, 254, 0.9)"
                }}>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>⚡</div>
                        <div>Real-time sync</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>💬</div>
                        <div>Smart feedback</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>🎨</div>
                        <div>Version control</div>
                    </div>
                </div>
                <button
                    onClick={handleGoogleSignIn}
                    className="fs-button-google"
                >
                    <span
                        style={{
                            display: "inline-flex",
                            width: "1.4rem",
                            height: "1.4rem",
                            borderRadius: "999px",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#020617",
                            fontSize: "0.9rem",
                        }}
                    >
                        G
                    </span>
                    <span>Continue with Google</span>
                </button>
                <p style={{
                    marginTop: "1.2rem",
                    fontSize: "0.75rem",
                    color: "rgba(148, 163, 184, 0.8)",
                    textAlign: "center"
                }}>
                    Secure authentication powered by Google
                </p>
            </div>
        </div>
    );
}

export default Login;
