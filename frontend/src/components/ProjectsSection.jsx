import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

function ProjectsSection() {
    const { token } = useAuth();

    const [projects, setProjects] = useState([]);
    const [assetsByProject, setAssetsByProject] = useState({});
    const [loadingProjects, setLoadingProjects] = useState(true);

    const [creating, setCreating] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [uploadingFor, setUploadingFor] = useState(null);

    const [activeAsset, setActiveAsset] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loadingComments, setLoadingComments] = useState(false);
    const [submittingComment, setSubmittingComment] = useState(false);

    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const [showAi, setShowAi] = useState(false); // NEW: controls visibility of the AI panel

    // Load projects
    useEffect(() => {
        if (!token) return;

        setLoadingProjects(true);
        api
            .get("/projects/", {
                headers: { Authorization: `Bearer ${token}` },
            })
            .then((res) => {
                setProjects(res.data);
            })
            .catch((err) => {
                console.error("Failed to load projects", err);
            })
            .finally(() => setLoadingProjects(false));
    }, [token]);

    // Auto-load assets for each project once
    useEffect(() => {
        if (!token || projects.length === 0) return;

        projects.forEach((project) => {
            if (!assetsByProject[project.id]) {
                loadAssets(project.id);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, projects]);

    const loadAssets = async (projectId) => {
        try {
            const res = await api.get(`/projects/${projectId}/assets`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setAssetsByProject((prev) => ({
                ...prev,
                [projectId]: res.data,
            }));
        } catch (err) {
            console.error("Failed to load assets", err);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setCreating(true);
        try {
            const res = await api.post(
                "/projects/",
                {
                    name: name.trim(),
                    description: description.trim() || null,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setProjects((prev) => [res.data, ...prev]);
            setName("");
            setDescription("");
        } catch (err) {
            console.error("Failed to create project", err);
            alert("Failed to create project.");
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id) => {
        const confirmDelete = window.confirm("Delete this project?");
        if (!confirmDelete) return;

        try {
            await api.delete(`/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setProjects((prev) => prev.filter((p) => p.id !== id));

            setAssetsByProject((prev) => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });

            if (activeAsset && assetsByProject[id]) {
                const stillHas = assetsByProject[id].some(
                    (a) => a.id === activeAsset.id
                );
                if (stillHas) setActiveAsset(null);
            }
        } catch (err) {
            console.error("Failed to delete project", err);
            alert("Failed to delete project.");
        }
    };

    const handleFileChange = async (projectId, event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingFor(projectId);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await api.post(
                `/projects/${projectId}/assets`,
                formData,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            setAssetsByProject((prev) => {
                const existing = prev[projectId] || [];
                return {
                    ...prev,
                    [projectId]: [res.data, ...existing],
                };
            });
        } catch (err) {
            console.error("Failed to upload asset", err);
            alert("Failed to upload asset.");
        } finally {
            setUploadingFor(null);
            event.target.value = "";
        }
    };

    const openAssetViewer = async (asset) => {
        setActiveAsset(asset);
        setComments([]);
        setAiSuggestions(null);
        setShowAi(false); // reset AI panel when opening another asset

        if (!asset) return;

        setLoadingComments(true);
        try {
            const res = await api.get(`/assets/${asset.id}/comments`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setComments(res.data);
        } catch (err) {
            console.error("Failed to load comments", err);
        } finally {
            setLoadingComments(false);
        }
    };

    const submitComment = async (e) => {
        e.preventDefault();
        if (!activeAsset) return;

        const content = newComment.trim();
        if (!content) return;

        setSubmittingComment(true);
        try {
            const res = await api.post(
                `/assets/${activeAsset.id}/comments`,
                { content },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setComments((prev) => [...prev, res.data]);
            setNewComment("");
        } catch (err) {
            console.error("Failed to add comment", err);
            alert("Failed to add comment.");
        } finally {
            setSubmittingComment(false);
        }
    };

    const fetchAiSuggestions = async () => {
        if (!activeAsset) return;
        setLoadingAi(true);
        setAiSuggestions(null);

        try {
            const res = await api.get(
                `/assets/${activeAsset.id}/ai-suggestions`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setAiSuggestions(res.data);
        } catch (err) {
            console.error("Failed to load AI suggestions", err);
            alert("Failed to load AI suggestions.");
        } finally {
            setLoadingAi(false);
        }
    };

    // NEW: button handler that either fetches or toggles visibility
    const handleAiButtonClick = async () => {
        if (!activeAsset || loadingAi) return;

        if (!aiSuggestions) {
            await fetchAiSuggestions();
            setShowAi(true);
        } else {
            setShowAi((prev) => !prev);
        }
    };

    if (loadingProjects) {
        return <p>Loading projects...</p>;
    }

    return (
        <section style={{ marginTop: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.75rem" }}>Projects</h2>

            {/* Create project form */}
            <form
                onSubmit={handleCreate}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    marginBottom: "1.5rem",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    backgroundColor: "#ffffff",
                }}
            >
                <input
                    type="text"
                    placeholder="Project name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                    }}
                    required
                />
                <textarea
                    placeholder="Short description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        resize: "vertical",
                    }}
                />
                <button
                    type="submit"
                    disabled={creating}
                    style={{
                        alignSelf: "flex-start",
                        padding: "0.4rem 0.9rem",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        backgroundColor: "#111827",
                        color: "#ffffff",
                        opacity: creating ? 0.7 : 1,
                    }}
                >
                    {creating ? "Creating..." : "Create project"}
                </button>
            </form>

            {/* Projects grid */}
            {projects.length === 0 ? (
                <p style={{ color: "#666" }}>
                    You have no projects yet. Create one to start managing design feedback.
                </p>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: "0.9rem",
                    }}
                >
                    {projects.map((project) => {
                        const assets = assetsByProject[project.id] || [];

                        return (
                            <div
                                key={project.id}
                                style={{
                                    padding: "0.85rem",
                                    borderRadius: "8px",
                                    border: "1px solid #e0e0e0",
                                    backgroundColor: "#ffffff",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.35rem",
                                }}
                            >
                                <div
                                    style={{
                                        fontWeight: 600,
                                        fontSize: "0.98rem",
                                    }}
                                >
                                    {project.name}
                                </div>
                                {project.description && (
                                    <div
                                        style={{
                                            fontSize: "0.85rem",
                                            color: "#555",
                                        }}
                                    >
                                        {project.description}
                                    </div>
                                )}

                                <div
                                    style={{
                                        marginTop: "0.4rem",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <label
                                        style={{
                                            fontSize: "0.78rem",
                                            padding: "0.25rem 0.6rem",
                                            borderRadius: "4px",
                                            border: "1px solid #ccc",
                                            cursor: "pointer",
                                            backgroundColor: "#f9fafb",
                                        }}
                                    >
                                        {uploadingFor === project.id
                                            ? "Uploading..."
                                            : "Upload asset"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={(e) => handleFileChange(project.id, e)}
                                            disabled={uploadingFor === project.id}
                                        />
                                    </label>

                                    <button
                                        onClick={() => loadAssets(project.id)}
                                        style={{
                                            padding: "0.25rem 0.6rem",
                                            fontSize: "0.78rem",
                                            borderRadius: "4px",
                                            border: "1px solid #e5e7eb",
                                            backgroundColor: "#f9fafb",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Refresh assets
                                    </button>

                                    <button
                                        onClick={() => handleDelete(project.id)}
                                        style={{
                                            padding: "0.25rem 0.6rem",
                                            fontSize: "0.78rem",
                                            borderRadius: "4px",
                                            border: "1px solid #fca5a5",
                                            backgroundColor: "#fef2f2",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>

                                {/* Assets thumbnails */}
                                {assets.length > 0 && (
                                    <div
                                        style={{
                                            marginTop: "0.4rem",
                                            display: "grid",
                                            gridTemplateColumns:
                                                "repeat(auto-fill, minmax(60px, 1fr))",
                                            gap: "0.25rem",
                                        }}
                                    >
                                        {assets.map((asset) => (
                                            <div
                                                key={asset.id}
                                                style={{
                                                    borderRadius: "4px",
                                                    overflow: "hidden",
                                                    border: "1px solid #e5e7eb",
                                                }}
                                            >
                                                <img
                                                    src={`http://localhost:8000/uploads/${asset.file_path}`}
                                                    alt={`Asset ${asset.id}`}
                                                    onClick={() => openAssetViewer(asset)}
                                                    style={{
                                                        width: "100%",
                                                        height: "60px",
                                                        objectFit: "cover",
                                                        display: "block",
                                                        cursor: "pointer",
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Asset viewer + comments + AI suggestions */}
            {activeAsset && (
                <div
                    onClick={() => setActiveAsset(null)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.45)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 40,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "min(1000px, 96vw)",
                            height: "85vh",
                            backgroundColor: "#ffffff",
                            borderRadius: "10px",
                            padding: "1rem",
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 2.2fr) minmax(260px, 1fr)",
                            gap: "0.75rem",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                        }}
                    >
                        {/* LEFT: image */}
                        <div
                            style={{
                                height: "100%",
                                borderRadius: "6px",
                                overflow: "auto",
                                border: "1px solid #e5e7eb",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#f9fafb",
                            }}
                        >
                            <img
                                src={`http://localhost:8000/uploads/${activeAsset.file_path}`}
                                alt={`Asset ${activeAsset.id}`}
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "100%",
                                    objectFit: "contain",
                                    display: "block",
                                }}
                            />
                        </div>

                        {/* RIGHT: comments + AI */}
                        <div
                            style={{
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.5rem",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                }}
                            >
                                <h3
                                    style={{
                                        margin: 0,
                                        fontSize: "1rem",
                                    }}
                                >
                                    Comments
                                </h3>

                                <div style={{ display: "flex", gap: "0.4rem" }}>
                                    <button
                                        onClick={handleAiButtonClick}
                                        disabled={loadingAi}
                                        style={{
                                            padding: "0.25rem 0.5rem",
                                            borderRadius: "4px",
                                            border: "1px solid #111827",
                                            fontSize: "0.75rem",
                                            backgroundColor: "#111827",
                                            color: "#ffffff",
                                            cursor: loadingAi ? "default" : "pointer",
                                            opacity: loadingAi ? 0.7 : 1,
                                            width: "10rem",
                                            height: "2rem",
                                        }}
                                    >
                                        {loadingAi
                                            ? "Analyzing..."
                                            : aiSuggestions
                                                ? showAi
                                                    ? "Hide AI suggestions ✨"
                                                    : "Show AI suggestions ✨"
                                                : " Show AI suggestions ✨"}
                                    </button>

                                    <button
                                        onClick={() => setActiveAsset(null)}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            cursor: "pointer",
                                            fontSize: "0.9rem",
                                            color: "#6b7280",
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* AI suggestions panel */}
                            {aiSuggestions && showAi && (
                                <div
                                    style={{
                                        borderRadius: "4px",
                                        border: "1px solid #e5e7eb",
                                        padding: "0.4rem",
                                        fontSize: "0.78rem",
                                        backgroundColor: "#f9fafb",
                                        maxHeight: "28%",
                                        overflowY: "auto",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            marginBottom: "0.25rem",
                                            fontSize: "0.8rem",
                                        }}
                                    >
                                        Automated visual review
                                    </div>
                                    <ul
                                        style={{
                                            paddingLeft: "1rem",
                                            margin: 0,
                                        }}
                                    >
                                        {aiSuggestions.suggestions.map((s, idx) => (
                                            <li key={idx} style={{ marginBottom: "0.15rem" }}>
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Comments list */}
                            <div
                                style={{
                                    flexGrow: 1,
                                    overflowY: "auto",
                                    paddingRight: "0.25rem",
                                    borderRadius: "4px",
                                    border: "1px solid #f3f4f6",
                                    padding: "0.4rem",
                                    fontSize: "0.85rem",
                                    backgroundColor: "#fafafa",
                                }}
                            >
                                {loadingComments ? (
                                    <p style={{ margin: 0, color: "#6b7280" }}>
                                        Loading comments...
                                    </p>
                                ) : comments.length === 0 ? (
                                    <p style={{ margin: 0, color: "#6b7280" }}>
                                        No comments yet. Start the discussion.
                                    </p>
                                ) : (
                                    comments.map((c) => (
                                        <div
                                            key={c.id}
                                            style={{
                                                marginBottom: "0.35rem",
                                                paddingBottom: "0.25rem",
                                                borderBottom: "1px solid #e5e7eb",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    fontSize: "0.75rem",
                                                    color: "#9ca3af",
                                                }}
                                            >
                                                #{c.id}
                                            </div>
                                            <div>{c.content}</div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Add comment */}
                            <form
                                onSubmit={submitComment}
                                style={{ display: "flex", gap: "0.35rem" }}
                            >
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Add a comment..."
                                    style={{
                                        flexGrow: 1,
                                        padding: "0.35rem 0.6rem",
                                        borderRadius: "4px",
                                        border: "1px solid #d1d5db",
                                        fontSize: "0.85rem",
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={submittingComment || !newComment.trim()}
                                    style={{
                                        padding: "0.35rem 0.7rem",
                                        borderRadius: "4px",
                                        border: "none",
                                        fontSize: "0.8rem",
                                        cursor:
                                            submittingComment || !newComment.trim()
                                                ? "default"
                                                : "pointer",
                                        backgroundColor: "#111827",
                                        color: "#ffffff",
                                        opacity:
                                            submittingComment || !newComment.trim() ? 0.6 : 1,
                                    }}
                                >
                                    {submittingComment ? "Sending..." : "Send"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default ProjectsSection;
