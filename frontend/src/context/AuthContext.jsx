// frontend/src/context/AuthContext.jsx

import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setTokenState] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Load token from localStorage on first mount
    useEffect(() => {
        const stored = localStorage.getItem("flowsync_token");
        if (!stored) {
            setLoading(false);
            return;
        }

        setTokenState(stored);
        fetchCurrentUser(stored);
    }, []);

    const fetchCurrentUser = async (jwt) => {
        if (!jwt) {
            setUser(null);
            setLoading(false);
            return;
        }

        try {
            // /auth/me currently expects ?token=...
            const res = await api.get("/auth/me", {
                params: { token: jwt },
            });
            setUser(res.data);
        } catch (err) {
            console.error("Failed to fetch current user", err);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const setToken = (jwt) => {
        if (jwt) {
            localStorage.setItem("flowsync_token", jwt);
            setTokenState(jwt);
            setLoading(true);
            fetchCurrentUser(jwt);
        } else {
            localStorage.removeItem("flowsync_token");
            setTokenState(null);
            setUser(null);
            setLoading(false);
        }
    };

    const logout = () => {
        setToken(null);
    };

    const value = {
        token,
        user,
        setToken,
        logout,
        loading,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}
