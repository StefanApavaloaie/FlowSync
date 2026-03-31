import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={styles.container}>
                    <h1 style={styles.heading}>Oops! Something went wrong.</h1>
                    <p style={styles.text}>
                        We apologize for the inconvenience. Please try refreshing the page or contact support if the problem persists.
                    </p>
                    <button
                        style={styles.button}
                        onClick={() => window.location.reload()}
                    >
                        Refresh Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

const styles = {
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#f9fafb",
        color: "#111827",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
        padding: "2rem",
    },
    heading: {
        fontSize: "2rem",
        marginBottom: "1rem",
        color: "#ef4444",
    },
    text: {
        fontSize: "1.125rem",
        marginBottom: "1.5rem",
        color: "#4b5563",
        maxWidth: "500px",
    },
    button: {
        padding: "0.75rem 1.5rem",
        fontSize: "1rem",
        fontWeight: "600",
        backgroundColor: "#3b82f6",
        color: "#ffffff",
        border: "none",
        borderRadius: "0.375rem",
        cursor: "pointer",
        transition: "background-color 0.2s",
    },
};

export default ErrorBoundary;
