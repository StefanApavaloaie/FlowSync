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
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "system-ui",
            }}
        >
            <div
                style={{
                    padding: "2rem",
                    borderRadius: "12px",
                    border: "1px solid #ddd",
                    maxWidth: "420px",
                    width: "100%",
                }}
            >
                <h1 style={{ marginBottom: "0.5rem" }}>FlowSync</h1>
                <p style={{ marginBottom: "1.5rem", color: "#555" }}>
                    Sign in to manage collaborative design feedback.
                </p>
                <button
                    onClick={handleGoogleSignIn}
                    style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        borderRadius: "8px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "1rem",
                    }}
                >
                    Continue with Google
                </button>
            </div>
        </div>
    );
}

export default Login;
