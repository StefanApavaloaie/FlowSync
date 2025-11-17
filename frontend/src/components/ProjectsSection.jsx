// frontend/src/components/ProjectsSection.jsx

import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

// emojis we support
const REACTION_EMOJIS = ["👍", "❤️", "💡", "😂", "😮"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

function getFileInfo(asset) {
    const filePath = asset?.file_path || "";
    const lastSlash = filePath.lastIndexOf("/");
    const base = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
    const dot = base.lastIndexOf(".");
    const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
    const name = asset.original_filename || base || "File";

    let kind = "file";
    let icon = "📁";
    let label = ext ? `${ext.toUpperCase()} file` : "File";

    if (IMAGE_EXTENSIONS.includes(ext)) {
        kind = "image";
        icon = "🖼";
        label = `${ext.toUpperCase()} image`;
    } else if (ext === "pdf") {
        kind = "pdf";
        icon = "📄";
        label = "PDF document";
    } else if (ext === "doc" || ext === "docx") {
        kind = "word";
        icon = "📄";
        label = "Word document";
    } else if (["xls", "xlsx", "csv"].includes(ext)) {
        kind = "sheet";
        icon = "📊";
        label = "Spreadsheet";
    } else if (ext === "ppt" || ext === "pptx") {
        kind = "deck";
        icon = "📈";
        label = "Presentation";
    } else if (ext === "txt" || ext === "md") {
        kind = "text";
        icon = "📜";
        label = "Text file";
    }

    return { ext, name, kind, icon, label };
}

function ProjectsSection({ refreshKey = 0 }) {
    const { token, user } = useAuth();

    const [ownedProjects, setOwnedProjects] = useState([]);
    const [archivedProjects, setArchivedProjects] = useState([]);
    const [sharedProjects, setSharedProjects] = useState([]);
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
    const [showAi, setShowAi] = useState(false);

    // per-project invite input
    const [inviteEmails, setInviteEmails] = useState({});

    // activity log
    const [activityProject, setActivityProject] = useState(null);
    const [activityItems, setActivityItems] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    // ---- helpers for project state updates ----

    const applyProjectUpdate = (updated) => {
        // Owned (active) list
        setOwnedProjects((prev) => {
            const exists = prev.some((p) => p.id === updated.id);

            if (!exists) {
                if (!updated.is_archived) {
                    return [updated, ...prev];
                }
                return prev;
            }

            if (updated.is_archived) {
                return prev.filter((p) => p.id !== updated.id);
            }

            return prev.map((p) => (p.id === updated.id ? updated : p));
        });

        // Archived list
        setArchivedProjects((prev) => {
            const exists = prev.some((p) => p.id === updated.id);

            if (updated.is_archived) {
                if (exists) {
                    return prev.map((p) => (p.id === updated.id ? updated : p));
                }
                return [updated, ...prev];
            }

            if (exists) {
                return prev.filter((p) => p.id !== updated.id);
            }

            return prev;
        });
    };

    // ---- load owned + shared + archived projects ----

    useEffect(() => {
        if (!token) return;

        setLoadingProjects(true);
        Promise.all([
            api.get("/projects/", {
                headers: { Authorization: `Bearer ${token}` },
            }),
            api.get("/projects/shared-with-me", {
                headers: { Authorization: `Bearer ${token}` },
            }),
            api.get("/projects/", {
                headers: { Authorization: `Bearer ${token}` },
                params: { archived: true },
            }),
        ])
            .then(([ownedRes, sharedRes, archivedRes]) => {
                setOwnedProjects(ownedRes.data);
                setSharedProjects(sharedRes.data);
                setArchivedProjects(archivedRes.data);
            })
            .catch((err) => {
                console.error("Failed to load projects", err);
            })
            .finally(() => setLoadingProjects(false));
    }, [token, refreshKey]);

    // Auto-load assets for each project (owned + shared + archived) once
    useEffect(() => {
        if (!token) return;
        const all = [...ownedProjects, ...sharedProjects, ...archivedProjects];
        if (all.length === 0) return;

        all.forEach((project) => {
            if (!assetsByProject[project.id]) {
                loadAssets(project.id);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, ownedProjects, sharedProjects, archivedProjects]);

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

    // ---- CRUD for projects ----

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
            setOwnedProjects((prev) => [res.data, ...prev]);
            setName("");
            setDescription("");
        } catch (err) {
            console.error("Failed to create project", err);
            alert("Failed to create project.");
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteProject = async (id) => {
        const confirmDelete = window.confirm("Delete this project?");
        if (!confirmDelete) return;

        try {
            await api.delete(`/projects/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setOwnedProjects((prev) => prev.filter((p) => p.id !== id));
            setArchivedProjects((prev) => prev.filter((p) => p.id !== id));

            setAssetsByProject((prev) => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });

            if (activeAsset && activeAsset.project_id === id) {
                setActiveAsset(null);
                setComments([]);
                setAiSuggestions(null);
                setShowAi(false);
            }
        } catch (err) {
            console.error("Failed to delete project", err);
            alert("Failed to delete project.");
        }
    };

    const handleRenameProject = async (project) => {
        const currentName = project.name || "";
        const newName = window.prompt("New project name", currentName);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed || trimmed === currentName) return;

        try {
            const res = await api.patch(
                `/projects/${project.id}`,
                { name: trimmed },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            applyProjectUpdate(res.data);
        } catch (err) {
            console.error("Failed to rename project", err);
            alert("Failed to rename project.");
        }
    };

    const handleArchiveToggle = async (project, targetArchived) => {
        if (project.is_archived === targetArchived) return;

        if (targetArchived) {
            const ok = window.confirm(
                "Archive this project? It will move to the Archived section until you unarchive it."
            );
            if (!ok) return;
        }

        try {
            const res = await api.patch(
                `/projects/${project.id}`,
                { is_archived: targetArchived },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            applyProjectUpdate(res.data);
        } catch (err) {
            console.error("Failed to update project archive state", err);
            alert("Failed to update project.");
        }
    };

    const handleLeaveProject = async (projectId) => {
        const confirmLeave = window.confirm(
            "Leave this project? You will lose access until invited again."
        );
        if (!confirmLeave) return;

        try {
            await api.post(
                `/projects/${projectId}/leave`,
                null,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            setSharedProjects((prev) =>
                prev.filter((p) => p.id !== projectId)
            );
            setAssetsByProject((prev) => {
                const copy = { ...prev };
                delete copy[projectId];
                return copy;
            });

            if (activeAsset && activeAsset.project_id === projectId) {
                setActiveAsset(null);
                setComments([]);
                setAiSuggestions(null);
                setShowAi(false);
            }
        } catch (err) {
            console.error("Failed to leave project", err);
            alert("Failed to leave project.");
        }
    };

    // ---- assets / comments / AI ----

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
        setShowAi(false);

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

    const handleDeleteComment = async (commentId) => {
        if (!activeAsset) return;

        const confirmDelete = window.confirm("Delete this comment?");
        if (!confirmDelete) return;

        try {
            await api.delete(
                `/assets/${activeAsset.id}/comments/${commentId}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            setComments((prev) => prev.filter((c) => c.id !== commentId));
        } catch (err) {
            console.error("Failed to delete comment", err);
            alert("Failed to delete comment.");
        }
    };

    const handleDeleteAsset = async () => {
        if (!activeAsset) return;

        const confirmDelete = window.confirm(
            "Delete this asset and all its comments?"
        );
        if (!confirmDelete) return;

        try {
            await api.delete(
                `/projects/${activeAsset.project_id}/assets/${activeAsset.id}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            setAssetsByProject((prev) => {
                const projectId = activeAsset.project_id;
                const existing = prev[projectId] || [];
                return {
                    ...prev,
                    [projectId]: existing.filter(
                        (a) => a.id !== activeAsset.id
                    ),
                };
            });

            setActiveAsset(null);
            setComments([]);
            setAiSuggestions(null);
            setShowAi(false);
        } catch (err) {
            console.error("Failed to delete asset", err);

            if (err.response?.status === 403) {
                alert(
                    "You are not allowed to delete this asset. Only the project owner can delete assets for now."
                );
            } else {
                alert("Failed to delete asset.");
            }
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

    const handleAiButtonClick = async () => {
        if (!activeAsset || loadingAi) return;

        if (!aiSuggestions) {
            await fetchAiSuggestions();
            setShowAi(true);
        } else {
            setShowAi((prev) => !prev);
        }
    };

    // ---- emoji reactions ----

    const handleToggleReaction = async (commentId, emoji) => {
        if (!activeAsset) return;

        try {
            const res = await api.post(
                `/assets/${activeAsset.id}/comments/${commentId}/reactions`,
                { emoji },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const updated = res.data;
            setComments((prev) =>
                prev.map((c) => (c.id === updated.id ? updated : c))
            );
        } catch (err) {
            console.error("Failed to toggle reaction", err);
            alert("Failed to toggle reaction.");
        }
    };

    // ---- invites ----

    const handleInviteChange = (projectId, value) => {
        setInviteEmails((prev) => ({
            ...prev,
            [projectId]: value,
        }));
    };

    const handleInvite = async (projectId) => {
        const raw = inviteEmails[projectId] || "";
        const email = raw.trim();
        if (!email) return;

        try {
            await api.post(
                `/projects/${projectId}/invites`,
                { invited_email: email },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            alert("Invitation sent.");
            setInviteEmails((prev) => ({
                ...prev,
                [projectId]: "",
            }));
        } catch (err) {
            console.error("Failed to send invite", err);
            const detail = err.response?.data?.detail;
            alert(detail || "Failed to send invite.");
        }
    };

    // ---- activity log ----

    const openActivityLog = async (project) => {
        setActivityProject(project);
        setActivityItems([]);
        setLoadingActivity(true);

        try {
            const res = await api.get(
                `/projects/${project.id}/activity`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setActivityItems(res.data);
        } catch (err) {
            console.error("Failed to load activity", err);
            alert("Failed to load activity.");
            setActivityProject(null);
        } finally {
            setLoadingActivity(false);
        }
    };

    const closeActivityLog = () => {
        setActivityProject(null);
        setActivityItems([]);
        setLoadingActivity(false);
    };

    // ---- rendering helpers ----

    if (loadingProjects) {
        return <p>Loading projects...</p>;
    }

    const renderProjectCard = (
        project,
        { isOwned = false, isShared = false, isArchived = false } = {}
    ) => {
        const assets = assetsByProject[project.id] || [];
        const inviteEmail = inviteEmails[project.id] || "";
        const archived = isArchived || project.is_archived;

        return (
            <div
                key={project.id}
                style={{
                    padding: "0.85rem",
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    backgroundColor: archived ? "#f9fafb" : "#ffffff",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                    opacity: archived ? 0.8 : 1,
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
                    <div
                        style={{
                            fontWeight: 600,
                            fontSize: "0.98rem",
                        }}
                    >
                        {project.name}
                    </div>
                    {archived && (
                        <span
                            style={{
                                fontSize: "0.7rem",
                                padding: "0.1rem 0.35rem",
                                borderRadius: "999px",
                                backgroundColor: "#e5e7eb",
                                color: "#4b5563",
                            }}
                        >
                            Archived
                        </span>
                    )}
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
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                    }}
                >
                    <label
                        style={{
                            fontSize: "0.78rem",
                            padding: "0.25rem 0.6rem",
                            borderRadius: "4px",
                            border: "1px solid #ccc",
                            cursor:
                                uploadingFor === project.id || archived
                                    ? "default"
                                    : "pointer",
                            backgroundColor: "#f9fafb",
                            opacity:
                                uploadingFor === project.id || archived
                                    ? 0.6
                                    : 1,
                        }}
                    >
                        {uploadingFor === project.id
                            ? "Uploading..."
                            : "Upload asset"}
                        <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                            style={{ display: "none" }}
                            onChange={(e) => handleFileChange(project.id, e)}
                            disabled={uploadingFor === project.id || archived}
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

                    {isOwned && (
                        <>
                            <button
                                onClick={() => handleRenameProject(project)}
                                style={{
                                    padding: "0.25rem 0.6rem",
                                    fontSize: "0.78rem",
                                    borderRadius: "4px",
                                    border: "1px solid #e5e7eb",
                                    backgroundColor: "#ffffff",
                                    cursor: "pointer",
                                }}
                            >
                                Rename
                            </button>

                            <button
                                onClick={() =>
                                    handleArchiveToggle(project, !archived)
                                }
                                style={{
                                    padding: "0.25rem 0.6rem",
                                    fontSize: "0.78rem",
                                    borderRadius: "4px",
                                    border: "1px solid #e5e7eb",
                                    backgroundColor: "#ffffff",
                                    cursor: "pointer",
                                }}
                            >
                                {archived ? "Unarchive" : "Archive"}
                            </button>

                            <button
                                onClick={() => handleDeleteProject(project.id)}
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
                        </>
                    )}

                    {isShared && (
                        <button
                            onClick={() => handleLeaveProject(project.id)}
                            style={{
                                padding: "0.25rem 0.6rem",
                                fontSize: "0.78rem",
                                borderRadius: "4px",
                                border: "1px solid #e5e7eb",
                                backgroundColor: "#fff7ed",
                                color: "#c2410c",
                                cursor: "pointer",
                            }}
                        >
                            Leave project
                        </button>
                    )}
                </div>

                {isOwned && !archived && (
                    <div
                        style={{
                            marginTop: "0.4rem",
                            display: "flex",
                            gap: "0.4rem",
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="email"
                            placeholder="Invite collaborator by email"
                            value={inviteEmail}
                            onChange={(e) =>
                                handleInviteChange(project.id, e.target.value)
                            }
                            style={{
                                flexGrow: 1,
                                padding: "0.35rem 0.6rem",
                                borderRadius: "4px",
                                border: "1px solid #d1d5db",
                                fontSize: "0.8rem",
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => handleInvite(project.id)}
                            style={{
                                padding: "0.35rem 0.7rem",
                                borderRadius: "4px",
                                border: "none",
                                fontSize: "0.8rem",
                                cursor: inviteEmail.trim()
                                    ? "pointer"
                                    : "default",
                                backgroundColor: inviteEmail.trim()
                                    ? "#111827"
                                    : "#9ca3af",
                                color: "#ffffff",
                            }}
                            disabled={!inviteEmail.trim()}
                        >
                            Invite
                        </button>
                    </div>
                )}

                <div
                    style={{
                        marginTop: "0.3rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.8rem",
                    }}
                >
                    <button
                        type="button"
                        onClick={() => openActivityLog(project)}
                        style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            color: "#2563eb",
                            textDecoration: "underline",
                        }}
                    >
                        View activity
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
                        {assets.map((asset) => {
                            const info = getFileInfo(asset);
                            const isImage = info.kind === "image";

                            return (
                                <div
                                    key={asset.id}
                                    style={{
                                        borderRadius: "4px",
                                        overflow: "hidden",
                                        border: "1px solid #e5e7eb",
                                    }}
                                >
                                    {isImage ? (
                                        <img
                                            src={`http://localhost:8000/uploads/${asset.file_path}`}
                                            alt={`Asset ${asset.id}`}
                                            onClick={() =>
                                                openAssetViewer(asset)
                                            }
                                            style={{
                                                width: "100%",
                                                height: "60px",
                                                objectFit: "cover",
                                                display: "block",
                                                cursor: "pointer",
                                            }}
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openAssetViewer(asset)
                                            }
                                            style={{
                                                width: "100%",
                                                height: "60px",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                border: "none",
                                                backgroundColor: "#f9fafb",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: "1.2rem",
                                                }}
                                            >
                                                {info.icon}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: "0.65rem",
                                                    marginTop: "0.1rem",
                                                    color: "#4b5563",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                {info.ext || "file"}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const hasOwned = ownedProjects.length > 0;
    const hasShared = sharedProjects.length > 0;
    const hasArchived = archivedProjects.length > 0;

    const isOwnerOfActiveAssetProject =
        activeAsset &&
        ownedProjects.some((p) => p.id === activeAsset.project_id);

    const activeFileInfo = activeAsset ? getFileInfo(activeAsset) : null;

    return (
        <section style={{ marginTop: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.75rem" }}>Projects</h2>

            {/* Create project form (for everyone, but they become owner) */}
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

            {/* Owned projects */}
            <div style={{ marginBottom: "1.5rem" }}>
                <h3
                    style={{
                        marginBottom: "0.5rem",
                        fontSize: "0.95rem",
                    }}
                >
                    My projects
                </h3>
                {!hasOwned ? (
                    <p style={{ color: "#666", fontSize: "0.9rem" }}>
                        You have no projects yet. Create one to start managing
                        design feedback.
                    </p>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(260px, 1fr))",
                            gap: "0.9rem",
                        }}
                    >
                        {ownedProjects.map((project) =>
                            renderProjectCard(project, { isOwned: true })
                        )}
                    </div>
                )}
            </div>

            {/* Archived projects (owned) */}
            <div style={{ marginBottom: "1.5rem" }}>
                <h3
                    style={{
                        marginBottom: "0.5rem",
                        fontSize: "0.95rem",
                    }}
                >
                    Archived projects
                </h3>
                {!hasArchived ? (
                    <p style={{ color: "#666", fontSize: "0.9rem" }}>
                        No archived projects. Archive a project to hide it from
                        your main list without deleting it.
                    </p>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(260px, 1fr))",
                            gap: "0.9rem",
                        }}
                    >
                        {archivedProjects.map((project) =>
                            renderProjectCard(project, {
                                isOwned: true,
                                isArchived: true,
                            })
                        )}
                    </div>
                )}
            </div>

            {/* Shared projects */}
            <div>
                <h3
                    style={{
                        marginBottom: "0.5rem",
                        fontSize: "0.95rem",
                    }}
                >
                    Projects I'm collaborating on
                </h3>
                {!hasShared ? (
                    <p style={{ color: "#666", fontSize: "0.9rem" }}>
                        No collaborations yet. Accept an invite to see shared
                        projects here.
                    </p>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(260px, 1fr))",
                            gap: "0.9rem",
                        }}
                    >
                        {sharedProjects.map((project) =>
                            renderProjectCard(project, { isShared: true })
                        )}
                    </div>
                )}
            </div>

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
                            gridTemplateColumns:
                                "minmax(0, 2.2fr) minmax(260px, 1fr)",
                            gap: "0.75rem",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
                        }}
                    >
                        {/* LEFT: preview */}
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
                            {activeFileInfo &&
                                activeFileInfo.kind === "image" ? (
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
                            ) : (
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        padding: "1rem",
                                        textAlign: "center",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: "2.6rem",
                                        }}
                                    >
                                        {activeFileInfo?.icon || "📁"}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: "0.6rem",
                                            fontWeight: 600,
                                            fontSize: "0.95rem",
                                        }}
                                    >
                                        {activeFileInfo?.name || "File"}
                                    </div>
                                    <div
                                        style={{
                                            marginTop: "0.15rem",
                                            fontSize: "0.8rem",
                                            color: "#6b7280",
                                        }}
                                    >
                                        {activeFileInfo?.label || "File"}
                                    </div>
                                    <a
                                        href={`http://localhost:8000/uploads/${activeAsset.file_path}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            marginTop: "0.75rem",
                                            fontSize: "0.8rem",
                                            padding:
                                                "0.4rem 0.8rem",
                                            borderRadius: "999px",
                                            border: "1px solid #111827",
                                            backgroundColor: "#111827",
                                            color: "#ffffff",
                                            textDecoration: "none",
                                        }}
                                    >
                                        Open / download file
                                    </a>
                                </div>
                            )}
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

                                <div
                                    style={{
                                        display: "flex",
                                        gap: "0.4rem",
                                        alignItems: "center",
                                    }}
                                >
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
                                            cursor: loadingAi
                                                ? "default"
                                                : "pointer",
                                            opacity: loadingAi ? 0.7 : 1,
                                            width: "10rem",
                                            height: "2rem",
                                        }}
                                    >
                                        {loadingAi
                                            ? "Analyzing..."
                                            : aiSuggestions
                                                ? showAi
                                                    ? "Hide AI Suggestions"
                                                    : "Show AI Suggestions"
                                                : "AI Suggestions"}
                                    </button>

                                    {isOwnerOfActiveAssetProject && (
                                        <button
                                            onClick={handleDeleteAsset}
                                            style={{
                                                padding: "0.25rem 0.6rem",
                                                borderRadius: "4px",
                                                border: "1px solid #ef4444",
                                                backgroundColor: "#fef2f2",
                                                color: "#b91c1c",
                                                fontSize: "0.75rem",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Delete asset
                                        </button>
                                    )}

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
                                        {aiSuggestions.suggestions.map(
                                            (s, idx) => (
                                                <li
                                                    key={idx}
                                                    style={{
                                                        marginBottom:
                                                            "0.15rem",
                                                    }}
                                                >
                                                    {s}
                                                </li>
                                            )
                                        )}
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
                                    comments.map((comment) => {
                                        const authorName =
                                            comment.user?.display_name ||
                                            comment.user?.email ||
                                            "Unknown user";
                                        const authorEmail =
                                            comment.user?.email || null;

                                        const canDelete =
                                            user &&
                                            comment.user_id === user.id;

                                        const reactions =
                                            comment.reactions || [];

                                        const grouped = {};
                                        reactions.forEach((r) => {
                                            if (!grouped[r.emoji]) {
                                                grouped[r.emoji] = {
                                                    count: 0,
                                                    reactedByMe: false,
                                                };
                                            }
                                            grouped[r.emoji].count += 1;
                                            if (
                                                user &&
                                                r.user_id === user.id
                                            ) {
                                                grouped[
                                                    r.emoji
                                                ].reactedByMe = true;
                                            }
                                        });

                                        return (
                                            <div
                                                key={comment.id}
                                                style={{
                                                    marginBottom: "0.35rem",
                                                    paddingBottom: "0.25rem",
                                                    borderBottom:
                                                        "1px solid #e5e7eb",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent:
                                                            "space-between",
                                                        alignItems: "center",
                                                        gap: "0.5rem",
                                                    }}
                                                >
                                                    <div>
                                                        <div
                                                            style={{
                                                                fontSize:
                                                                    "0.8rem",
                                                                fontWeight: 500,
                                                                color: "#374151",
                                                            }}
                                                        >
                                                            {authorName}
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize:
                                                                    "0.75rem",
                                                                color:
                                                                    "#9ca3af",
                                                            }}
                                                        >
                                                            {authorEmail ||
                                                                "Unknown email"}
                                                        </div>
                                                    </div>

                                                    {canDelete && (
                                                        <button
                                                            onClick={() =>
                                                                handleDeleteComment(
                                                                    comment.id
                                                                )
                                                            }
                                                            style={{
                                                                border: "none",
                                                                background:
                                                                    "transparent",
                                                                color:
                                                                    "#ef4444",
                                                                fontSize:
                                                                    "0.75rem",
                                                                cursor:
                                                                    "pointer",
                                                            }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>

                                                <div
                                                    style={{
                                                        marginTop: "0.2rem",
                                                    }}
                                                >
                                                    {comment.content}
                                                </div>

                                                {/* Emoji reactions bar */}
                                                <div
                                                    style={{
                                                        marginTop: "0.25rem",
                                                        display: "flex",
                                                        gap: "0.25rem",
                                                        flexWrap: "wrap",
                                                    }}
                                                >
                                                    {REACTION_EMOJIS.map(
                                                        (emoji) => {
                                                            const info =
                                                                grouped[
                                                                emoji
                                                                ] || {
                                                                    count: 0,
                                                                    reactedByMe:
                                                                        false,
                                                                };

                                                            const isActive =
                                                                info.reactedByMe;
                                                            const countLabel =
                                                                info.count > 0
                                                                    ? info.count
                                                                    : "";

                                                            return (
                                                                <button
                                                                    key={emoji}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleToggleReaction(
                                                                            comment.id,
                                                                            emoji
                                                                        )
                                                                    }
                                                                    style={{
                                                                        display:
                                                                            "inline-flex",
                                                                        alignItems:
                                                                            "center",
                                                                        gap: "0.18rem",
                                                                        padding:
                                                                            "0.12rem 0.35rem",
                                                                        borderRadius:
                                                                            "999px",
                                                                        border: `1px solid ${isActive
                                                                                ? "#4f46e5"
                                                                                : "#e5e7eb"
                                                                            }`,
                                                                        backgroundColor:
                                                                            isActive
                                                                                ? "#eef2ff"
                                                                                : "#f9fafb",
                                                                        fontSize:
                                                                            "0.75rem",
                                                                        cursor:
                                                                            "pointer",
                                                                    }}
                                                                >
                                                                    <span>
                                                                        {emoji}
                                                                    </span>
                                                                    {countLabel && (
                                                                        <span
                                                                            style={{
                                                                                fontSize:
                                                                                    "0.7rem",
                                                                                color:
                                                                                    "#4b5563",
                                                                            }}
                                                                        >
                                                                            {
                                                                                countLabel
                                                                            }
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            );
                                                        }
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
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
                                    onChange={(e) =>
                                        setNewComment(e.target.value)
                                    }
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
                                    disabled={
                                        submittingComment || !newComment.trim()
                                    }
                                    style={{
                                        padding: "0.35rem 0.7rem",
                                        borderRadius: "4px",
                                        border: "none",
                                        fontSize: "0.8rem",
                                        cursor:
                                            submittingComment ||
                                                !newComment.trim()
                                                ? "default"
                                                : "pointer",
                                        backgroundColor: "#111827",
                                        color: "#ffffff",
                                        opacity:
                                            submittingComment ||
                                                !newComment.trim()
                                                ? 0.6
                                                : 1,
                                    }}
                                >
                                    {submittingComment ? "Sending..." : "Send"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Activity log modal */}
            {activityProject && (
                <div
                    onClick={closeActivityLog}
                    style={{
                        position: "fixed",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.35)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 50,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: "min(480px, 90vw)",
                            maxHeight: "70vh",
                            backgroundColor: "#ffffff",
                            borderRadius: "10px",
                            padding: "0.9rem",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
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
                                Activity – {activityProject.name}
                            </h3>
                            <button
                                onClick={closeActivityLog}
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

                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "#6b7280",
                            }}
                        >
                            Recent actions in this project.
                        </div>

                        <div
                            style={{
                                flexGrow: 1,
                                overflowY: "auto",
                                marginTop: "0.25rem",
                                paddingRight: "0.25rem",
                            }}
                        >
                            {loadingActivity ? (
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    Loading activity...
                                </p>
                            ) : activityItems.length === 0 ? (
                                <p
                                    style={{
                                        margin: 0,
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    No activity yet.
                                </p>
                            ) : (
                                activityItems.map((a) => {
                                    const when = new Date(
                                        a.created_at
                                    ).toLocaleString();
                                    return (
                                        <div
                                            key={a.id}
                                            style={{
                                                padding: "0.35rem 0",
                                                borderBottom:
                                                    "1px solid #e5e7eb",
                                                fontSize: "0.82rem",
                                            }}
                                        >
                                            <div>{a.message}</div>
                                            <div
                                                style={{
                                                    fontSize: "0.7rem",
                                                    color: "#9ca3af",
                                                    marginTop: "0.1rem",
                                                }}
                                            >
                                                {when}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default ProjectsSection;
