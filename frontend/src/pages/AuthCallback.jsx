import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AuthCallback() {
    const { setToken } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const token = params.get("token");

        if (!token) {
            navigate("/", { replace: true });
            return;
        }

        setToken(token);
        navigate("/dashboard", { replace: true });
    }, [location.search, setToken, navigate]);

    return (
        <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
            Finishing sign-in...
        </div>
    );
}

export default AuthCallback;
