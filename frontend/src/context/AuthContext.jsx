import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => {
        return localStorage.getItem("flowsync_token") || null;
    });
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(!!token);

    useEffect(() => {
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }

        // Fetch user from backend using debug /auth/me endpoint
        api
            .get("/auth/me", { params: { token } })
            .then((res) => {
                setUser(res.data);
            })
            .catch(() => {
                // Invalid token → clear it
                localStorage.removeItem("flowsync_token");
                setToken(null);
                setUser(null);
            })
            .finally(() => setLoading(false));
    }, [token]);

    const value = {
        token,
        user,
        loading,
        setToken: (newToken) => {
            if (newToken) {
                localStorage.setItem("flowsync_token", newToken);
            } else {
                localStorage.removeItem("flowsync_token");
            }
            setToken(newToken);
        },
        logout: () => {
            localStorage.removeItem("flowsync_token");
            setToken(null);
            setUser(null);
        },
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return ctx;
}
