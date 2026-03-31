import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// import * as Sentry from "@sentry/react";

import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import './index.css';

// Sentry.init({
//     dsn: "YOUR_SENTRY_DSN",
//     integrations: [
//         Sentry.browserTracingIntegration(),
//         Sentry.replayIntegration(),
//     ],
//     tracesSampleRate: 1.0,
//     replaysSessionSampleRate: 0.1,
//     replaysOnErrorSampleRate: 1.0,
// });

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <App />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
