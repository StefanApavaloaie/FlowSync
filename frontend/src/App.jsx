import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";

function App() {
    const { token, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
                Loading...
            </div>
        );
    }

    return (
        <Routes>
            <Route
                path="/"
                element={token ? <Navigate to="/dashboard" replace /> : <Login />}
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
                path="/dashboard"
                element={token ? <Dashboard /> : <Navigate to="/" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
