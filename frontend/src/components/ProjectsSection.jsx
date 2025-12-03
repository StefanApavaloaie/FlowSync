// frontend/src/components/ProjectsSection.jsx

import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import ProjectActionsMenu from "./ProjectsActionMenu";

// emojis we support
const REACTION_EMOJIS = ["👍", "❤️", "💡", "😂", "😮"];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

// asset status options
const ASSET_STATUS_OPTIONS = [
    { value: "needs_feedback", label: "Needs feedback" },
    { value: "in_progress", label: "In progress" },
    { value: "changes_requested", label: "Changes requested" },
    { value: "final", label: "Final" },
];

function getAssetStatusLabel(status) {
    const found = ASSET_STATUS_OPTIONS.find((s) => s.value === status);
    return found ? found.label : "Needs feedback";
}

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
function sortProjectsBy(projects, sortOption) {
    const safeCreated = (p) => {
        if (!p.created_at) return 0;
        const t = new Date(p.created_at).getTime();
        return Number.isNaN(t) ? 0 : t;
    };

    const safeDeadline = (p) => {
        if (!p.deadline) return Number.POSITIVE_INFINITY;
        const t = new Date(p.deadline).getTime();
        return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
    };

    const copy = [...projects];

    if (sortOption === "oldest") {
        // oldest created first
        copy.sort((a, b) => safeCreated(a) - safeCreated(b));
    } else if (sortOption === "deadline") {
        // earliest deadline first, “no deadline” goes last
        copy.sort((a, b) => safeDeadline(a) - safeDeadline(b));
    } else {
        // default: newest created first
        copy.sort((a, b) => safeCreated(b) - safeCreated(a));
    }

    return copy;
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
    const [newDeadline, setNewDeadline] = useState("");
    const [uploadingFor, setUploadingFor] = useState(null);

    const [activeAsset, setActiveAsset] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [loadingComments, setLoadingComments] = useState(false);
    const [submittingComment, setSubmittingComment] = useState(false);

    const [replyTo, setReplyTo] = useState(null);

    const [aiSuggestions, setAiSuggestions] = useState(null);
    const [loadingAi, setLoadingAi] = useState(false);
    const [showAi, setShowAi] = useState(false);

    // per-project invite input
    const [inviteEmails, setInviteEmails] = useState({});

    // activity log
    const [activityProject, setActivityProject] = useState(null);
    const [activityItems, setActivityItems] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [sortOwnedBy, setSortOwnedBy] = useState("newest"); // "newest" | "oldest" | "deadline"

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
                    deadline: newDeadline || null,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setOwnedProjects((prev) => [res.data, ...prev]);
            setName("");
            setDescription("");
            setNewDeadline("");
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
                setReplyTo(null);
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

    const handleUpdateProjectDeadline = async (project, dateValue) => {
        const deadline =
            dateValue && dateValue.trim ? dateValue.trim() : dateValue || null;

        try {
            const res = await api.patch(
                `/projects/${project.id}`,
                { deadline: deadline || null },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            applyProjectUpdate(res.data);
        } catch (err) {
            console.error("Failed to update project deadline", err);
            alert("Failed to update deadline.");
        }
    };

    const handleLeaveProject = async (projectId) => {
        const confirmLeave = window.confirm(
            "Leave this project? You will lose access until invited again."
        );
        if (!confirmLeave) return;

        try {
            await api.post(`/projects/${projectId}/leave`, null, {
                headers: { Authorization: `Bearer ${token}` },
            });

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
                setReplyTo(null);
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
        setReplyTo(null);
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

        const parent_id = replyTo ? replyTo.id : null;

        setSubmittingComment(true);
        try {
            const res = await api.post(
                `/assets/${activeAsset.id}/comments`,
                { content, parent_id },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setComments((prev) => [...prev, res.data]);
            setNewComment("");
            setReplyTo(null);
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
            if (replyTo && replyTo.id === commentId) {
                setReplyTo(null);
            }
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
            setReplyTo(null);
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

    const handleChangeAssetStatus = async (asset, newStatus) => {
        if (!asset) return;

        try {
            const res = await api.patch(
                `/assets/${asset.id}/status`,
                { status: newStatus },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            const updated = res.data;

            // Update active asset
            setActiveAsset((prev) =>
                prev && prev.id === updated.id ? updated : prev
            );

            // Update in project asset list
            setAssetsByProject((prev) => {
                const projectId = updated.project_id;
                const existing = prev[projectId] || [];
                return {
                    ...prev,
                    [projectId]: existing.map((a) =>
                        a.id === updated.id ? updated : a
                    ),
                };
            });
        } catch (err) {
            console.error("Failed to update asset status", err);
            alert("Failed to update asset status.");
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
            const res = await api.get(`/projects/${project.id}/activity`, {
                headers: { Authorization: `Bearer ${token}` },
            });
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

    // ---- threaded comments helpers ----

    const buildCommentTree = () => {
        if (!comments || comments.length === 0) return [];

        const byId = new Map();
        comments.forEach((c) => {
            byId.set(c.id, { ...c, children: [] });
        });

        const roots = [];

        const sortByCreated = (a, b) => {
            const da = new Date(a.created_at);
            const db = new Date(b.created_at);
            return da - db;
        };

        byId.forEach((comment) => {
            if (comment.parent_id && byId.has(comment.parent_id)) {
                const parent = byId.get(comment.parent_id);
                parent.children.push(comment);
            } else {
                roots.push(comment);
            }
        });

        const sortRecursively = (node) => {
            if (node.children && node.children.length > 0) {
                node.children.sort(sortByCreated);
                node.children.forEach(sortRecursively);
            }
        };

        roots.sort(sortByCreated);
        roots.forEach(sortRecursively);

        return roots;
    };

    const renderCommentNode = (comment, depth = 0) => {
        const authorName =
            comment.user?.display_name ||
            comment.user?.email ||
            "Unknown user";
        const authorEmail = comment.user?.email || null;

        const canDelete = user && comment.user_id === user.id;

        const reactions = comment.reactions || [];
        const grouped = {};
        reactions.forEach((r) => {
            if (!grouped[r.emoji]) {
                grouped[r.emoji] = {
                    count: 0,
                    reactedByMe: false,
                };
            }
            grouped[r.emoji].count += 1;
            if (user && r.user_id === user.id) {
                grouped[r.emoji].reactedByMe = true;
            }
        });

        const indentPx = depth > 0 ? depth * 16 : 0;

        return (
            <div
                key={comment.id}
                style={{
                    marginBottom: "0.35rem",
                    paddingBottom: "0.25rem",
                    borderBottom:
                        depth === 0 ? "1px solid #1f2937" : "none",
                    marginLeft: indentPx,
                    color: "#e5e7eb",
                    fontSize: "0.85rem",
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
                    <div>
                        <div
                            style={{
                                fontSize: "0.8rem",
                                fontWeight: 500,
                                color: "#e5e7eb",
                            }}
                        >
                            {authorName}
                        </div>
                        <div
                            style={{
                                fontSize: "0.75rem",
                                color: "#9ca3af",
                            }}
                        >
                            {authorEmail || "Unknown email"}
                        </div>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setReplyTo(comment)}
                            style={{
                                border: "none",
                                background: "transparent",
                                color: "#93c5fd",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                            }}
                        >
                            Reply
                        </button>

                        {canDelete && (
                            <button
                                onClick={() =>
                                    handleDeleteComment(comment.id)
                                }
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#fca5a5",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                }}
                            >
                                Delete
                            </button>
                        )}
                    </div>
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
                    {REACTION_EMOJIS.map((emoji) => {
                        const info =
                            grouped[emoji] || {
                                count: 0,
                                reactedByMe: false,
                            };

                        const isActive = info.reactedByMe;
                        const countLabel =
                            info.count > 0 ? info.count : "";

                        return (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() =>
                                    handleToggleReaction(comment.id, emoji)
                                }
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.18rem",
                                    padding: "0.12rem 0.35rem",
                                    borderRadius: "999px",
                                    border: `1px solid ${isActive
                                        ? "rgba(129,140,248,0.9)"
                                        : "rgba(55,65,81,0.9)"
                                        }`,
                                    backgroundColor: isActive
                                        ? "rgba(30,64,175,0.5)"
                                        : "rgba(15,23,42,0.9)",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                    color: "#e5e7eb",
                                }}
                            >
                                <span>{emoji}</span>
                                {countLabel && (
                                    <span
                                        style={{
                                            fontSize: "0.7rem",
                                            color: "#cbd5f5",
                                        }}
                                    >
                                        {countLabel}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Children */}
                {comment.children &&
                    comment.children.length > 0 &&
                    comment.children.map((child) =>
                        renderCommentNode(child, depth + 1)
                    )}
            </div>
        );
    };

    // ---- rendering helpers ----

    if (loadingProjects) {
        return (
            <section className="fs-section-projects">
                <p style={{ color: "#9ca3af" }}>Loading projects...</p>
            </section>
        );
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
                className="fs-project-card"
                data-archived={archived ? "true" : "false"}
                style={{
                    opacity: archived ? 0.85 : 1,
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
                    <div className="fs-project-card-title">
                        {project.name}
                    </div>
                    {archived && (
                        <span
                            style={{
                                fontSize: "0.7rem",
                                padding: "0.1rem 0.45rem",
                                borderRadius: "999px",
                                backgroundColor: "rgba(15,23,42,0.9)",
                                border:
                                    "1px solid rgba(148,163,184,0.6)",
                                color: "#9ca3af",
                            }}
                        >
                            Archived
                        </span>
                    )}
                </div>

                {project.description && (
                    <div className="fs-project-card-desc">
                        {project.description}
                    </div>
                )}

                {/* Deadline row */}
                <div
                    style={{
                        marginTop: "0.25rem",
                        fontSize: "0.8rem",
                        color: "#e5e7eb",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        flexWrap: "wrap",
                    }}
                >
                    <span
                        style={{
                            fontWeight: 500,
                            color: "#bfdbfe",
                        }}
                    >
                        Deadline:
                    </span>
                    {isOwned && !archived ? (
                        <>
                            <input
                                type="date"
                                value={project.deadline || ""}
                                onChange={(e) =>
                                    handleUpdateProjectDeadline(
                                        project,
                                        e.target.value
                                    )
                                }
                                className="fs-date"
                                style={{
                                    fontSize: "0.78rem",
                                }}
                            />
                            {!project.deadline && (
                                <span
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#6b7280",
                                    }}
                                >
                                    Not set
                                </span>
                            )}
                        </>
                    ) : (
                        <span style={{ color: "#9ca3af" }}>
                            {project.deadline || "Not set"}
                        </span>
                    )}
                </div>

                <div
                    style={{
                        marginTop: "0.4rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                    }}
                >
                    {/* Upload stays as a normal button */}
                    <label
                        style={{
                            fontSize: "0.78rem",
                            padding: "0.25rem 0.8rem",
                            borderRadius: "999px",
                            border: "1px solid rgba(96,165,250,0.6)",
                            cursor:
                                uploadingFor === project.id || archived
                                    ? "default"
                                    : "pointer",
                            background:
                                "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,64,175,0.8))",
                            color: "#e5e7eb",
                            opacity:
                                uploadingFor === project.id || archived
                                    ? 0.6
                                    : 1,
                        }}
                    >
                        {uploadingFor === project.id ? "Uploading..." : "Upload asset"}
                        <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                            style={{ display: "none" }}
                            onChange={(e) => handleFileChange(project.id, e)}
                            disabled={uploadingFor === project.id || archived}
                        />
                    </label>

                    {/* 🔽 Options dropdown for owned projects */}
                    {isOwned && (
                        <ProjectActionsMenu
                            archived={archived}
                            onUploadAsset={() => {
                                const parent = document.activeElement?.closest(
                                    ".fs-project-card"
                                );
                                if (!parent) return;
                                const input = parent.querySelector("input[type='file']");
                                if (input && !archived && uploadingFor !== project.id) {
                                    input.click();
                                }
                            }}
                            onRefreshAssets={() => loadAssets(project.id)}
                            onRename={() => handleRenameProject(project)}
                            onArchive={() => handleArchiveToggle(project, !archived)}
                            onDelete={() => handleDeleteProject(project.id)}
                        />
                    )}

                    {isShared && (
                        <button
                            onClick={() => handleLeaveProject(project.id)}
                            style={{
                                padding: "0.25rem 0.8rem",
                                fontSize: "0.78rem",
                                borderRadius: "999px",
                                border: "1px solid rgba(248,153,72,0.8)",
                                backgroundColor: "rgba(120,53,15,0.5)",
                                color: "#fed7aa",
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
                                borderRadius: "999px",
                                border:
                                    "1px solid rgba(148,163,184,0.6)",
                                fontSize: "0.8rem",
                                backgroundColor: "rgba(15,23,42,0.9)",
                                color: "#e5e7eb",
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => handleInvite(project.id)}
                            style={{
                                padding: "0.35rem 0.8rem",
                                borderRadius: "999px",
                                border: "none",
                                fontSize: "0.8rem",
                                cursor: inviteEmail.trim()
                                    ? "pointer"
                                    : "default",
                                background:
                                    "linear-gradient(135deg, #0ea5e9, #2563eb)",
                                color: "#ffffff",
                                opacity: inviteEmail.trim() ? 1 : 0.45,
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
                            color: "#60a5fa",
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
                                        borderRadius: "8px",
                                        overflow: "hidden",
                                        border:
                                            "1px solid rgba(31,41,55,0.9)",
                                        backgroundColor:
                                            "rgba(15,23,42,0.95)",
                                        display: "flex",
                                        flexDirection: "column",
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
                                                backgroundColor:
                                                    "rgba(15,23,42,0.95)",
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
                                                    color: "#9ca3af",
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                {info.ext || "file"}
                                            </span>
                                        </button>
                                    )}

                                    <div
                                        style={{
                                            padding: "0.1rem 0.25rem",
                                            borderTop:
                                                "1px solid rgba(31,41,55,0.9)",
                                            fontSize: "0.65rem",
                                            textAlign: "center",
                                            backgroundColor:
                                                "rgba(17,24,39,0.95)",
                                            color: "#cbd5f5",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {getAssetStatusLabel(asset.status)}
                                    </div>
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
    const sortedOwnedProjects = sortProjectsBy(ownedProjects, sortOwnedBy);


    const isOwnerOfActiveAssetProject =
        activeAsset &&
        ownedProjects.some((p) => p.id === activeAsset.project_id);

    const activeFileInfo = activeAsset ? getFileInfo(activeAsset) : null;

    const uploadedMeta = (() => {
        if (!activeAsset) return null;
        const isMe = user && activeAsset.user_id === user.id;
        const uploaderText = isMe ? "you" : "a collaborator";
        let whenText = "";
        if (activeAsset.created_at) {
            try {
                whenText = new Date(
                    activeAsset.created_at
                ).toLocaleString();
            } catch {
                whenText = "";
            }
        }
        return { uploaderText, whenText };
    })();

    const commentTree = buildCommentTree();

    return (
        <section className="fs-section-projects">
            <h2 style={{ marginBottom: "0.75rem" }}>Projects</h2>

            {/* Create project form */}
            <form
                onSubmit={handleCreate}
                className="fs-create-card"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    marginBottom: "1.8rem",
                }}
            >
                <input
                    type="text"
                    placeholder="Project name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="fs-input"
                    required
                />
                <textarea
                    placeholder="Short description (optional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="fs-textarea"
                />
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                        fontSize: "0.85rem",
                        color: "#cbd5f5",
                    }}
                >
                    <label
                        style={{
                            fontSize: "0.8rem",
                            color: "#bfdbfe",
                        }}
                    >
                        Deadline:
                    </label>
                    <input
                        type="date"
                        value={newDeadline}
                        onChange={(e) => setNewDeadline(e.target.value)}
                        className="fs-date"
                    />
                    <span
                        style={{
                            fontSize: "0.75rem",
                            color: "#6b7280",
                        }}
                    >
                        (optional)
                    </span>
                </div>
                <button
                    type="submit"
                    disabled={creating}
                    className="fs-primary-button"
                    style={{
                        alignSelf: "flex-start",
                        opacity: creating ? 0.8 : 1,
                        cursor: creating ? "default" : "pointer",
                    }}
                >
                    {creating ? "Creating..." : "Create project"}
                </button>
            </form>

            {/* Owned projects */}

            <div id="fs-my-projects-section" style={{ marginBottom: "1.5rem" }}>
                <div
                    style={{
                        marginBottom: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.75rem",
                    }}
                >
                    <h3
                        style={{
                            margin: 0,
                            fontSize: "0.95rem",
                            color: "#f9fafb",
                        }}
                    >
                        My projects
                    </h3>

                    {hasOwned && (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                                fontSize: "0.8rem",
                                color: "#9ca3af",
                            }}
                        >
                            <span>Sort by:</span>
                            <button
                                type="button"
                                onClick={() => setSortOwnedBy("newest")}
                                style={{
                                    padding: "0.18rem 0.6rem",
                                    borderRadius: "999px",
                                    border:
                                        sortOwnedBy === "newest"
                                            ? "1px solid rgba(96,165,250,0.9)"
                                            : "1px solid rgba(30,64,175,0.7)",
                                    background:
                                        sortOwnedBy === "newest"
                                            ? "linear-gradient(135deg,#1d4ed8,#2563eb)"
                                            : "rgba(15,23,42,0.9)",
                                    color:
                                        sortOwnedBy === "newest"
                                            ? "#f9fafb"
                                            : "#9ca3af",
                                    cursor: "pointer",
                                    fontSize: "0.78rem",
                                }}
                            >
                                Newest
                            </button>
                            <button
                                type="button"
                                onClick={() => setSortOwnedBy("oldest")}
                                style={{
                                    padding: "0.18rem 0.6rem",
                                    borderRadius: "999px",
                                    border:
                                        sortOwnedBy === "oldest"
                                            ? "1px solid rgba(96,165,250,0.9)"
                                            : "1px solid rgba(30,64,175,0.7)",
                                    background:
                                        sortOwnedBy === "oldest"
                                            ? "linear-gradient(135deg,#1d4ed8,#2563eb)"
                                            : "rgba(15,23,42,0.9)",
                                    color:
                                        sortOwnedBy === "oldest"
                                            ? "#f9fafb"
                                            : "#9ca3af",
                                    cursor: "pointer",
                                    fontSize: "0.78rem",
                                }}
                            >
                                Oldest
                            </button>
                            <button
                                type="button"
                                onClick={() => setSortOwnedBy("deadline")}
                                style={{
                                    padding: "0.18rem 0.6rem",
                                    borderRadius: "999px",
                                    border:
                                        sortOwnedBy === "deadline"
                                            ? "1px solid rgba(96,165,250,0.9)"
                                            : "1px solid rgba(30,64,175,0.7)",
                                    background:
                                        sortOwnedBy === "deadline"
                                            ? "linear-gradient(135deg,#1d4ed8,#2563eb)"
                                            : "rgba(15,23,42,0.9)",
                                    color:
                                        sortOwnedBy === "deadline"
                                            ? "#f9fafb"
                                            : "#9ca3af",
                                    cursor: "pointer",
                                    fontSize: "0.78rem",
                                }}
                            >
                                Deadline
                            </button>
                        </div>
                    )}
                </div>

                {!hasOwned ? (
                    <div className="fs-empty-card">
                        You have no projects yet. Create one to start
                        managing design feedback.
                    </div>
                ) : (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns:
                                "repeat(auto-fill, minmax(260px, 1fr))",
                            gap: "0.9rem",
                        }}
                    >
                        {sortedOwnedProjects.map((project) =>
                            renderProjectCard(project, { isOwned: true })
                        )}
                    </div>
                )}
            </div>


            {/* Archived projects */}
            <div style={{ marginBottom: "1.5rem" }}>
                <h3
                    style={{
                        marginBottom: "0.5rem",
                        fontSize: "0.95rem",
                        color: "#f9fafb",
                    }}
                >
                    Archived projects
                </h3>
                {!hasArchived ? (
                    <div className="fs-empty-card">
                        No archived projects. Archive a project to hide it
                        from your main list without deleting it.
                    </div>
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
                        color: "#f9fafb",
                    }}
                >
                    Projects I'm collaborating on
                </h3>
                {!hasShared ? (
                    <div className="fs-empty-card">
                        No collaborations yet. Accept an invite to see
                        shared projects here.
                    </div>
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
                        background:
                            "radial-gradient(circle at top, rgba(37,99,235,0.3), transparent 55%), rgba(0,0,0,0.75)",
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
                            background:
                                "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.96))",
                            borderRadius: "16px",
                            padding: "1rem",
                            display: "grid",
                            gridTemplateColumns:
                                "minmax(0, 2.2fr) minmax(260px, 1fr)",
                            gap: "0.75rem",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
                            border: "1px solid rgba(30,64,175,0.8)",
                            color: "#e5e7eb",
                            overflow: "hidden",
                        }}
                    >
                        {/* LEFT: preview */}
                        <div
                            style={{
                                height: "100%",
                                minHeight: 0,
                                overflow: "hidden",
                                borderRadius: "10px",
                                overflow: "auto",
                                border:
                                    "1px solid rgba(31,41,55,0.95)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background:
                                    "radial-gradient(circle at top left, rgba(30,64,175,0.22), transparent 55%), #020617",
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
                                            color: "#9ca3af",
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
                                            border:
                                                "1px solid rgba(96,165,250,0.9)",
                                            background:
                                                "linear-gradient(135deg,#1d4ed8,#2563eb)",
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
                                minHeight: 0,
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
                                        color: "#f9fafb",
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
                                    {/* <button
                                        onClick={handleAiButtonClick}
                                        disabled={loadingAi}
                                        style={{
                                            padding: "0.25rem 0.5rem",
                                            borderRadius: "8px",
                                            border:
                                                "1px solid rgba(129,140,248,0.9)",
                                            fontSize: "0.75rem",
                                            background:
                                                "linear-gradient(135deg,rgba(30,64,175,0.9),rgba(129,140,248,0.9))",
                                            color: "#eef2ff",
                                            cursor: loadingAi
                                                ? "default"
                                                : "pointer",
                                            opacity: loadingAi ? 0.8 : 1,
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
                                    </button> */}

                                    {isOwnerOfActiveAssetProject && (
                                        <button
                                            onClick={handleDeleteAsset}
                                            style={{
                                                padding:
                                                    "0.25rem 0.6rem",
                                                borderRadius: "8px",
                                                border:
                                                    "1px solid rgba(248,113,113,0.8)",
                                                backgroundColor:
                                                    "rgba(127,29,29,0.35)",
                                                color: "#fecaca",
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
                                            color: "#9ca3af",
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {uploadedMeta && (
                                <div
                                    style={{
                                        fontSize: "0.75rem",
                                        color: "#9ca3af",
                                    }}
                                >
                                    Uploaded by {uploadedMeta.uploaderText}
                                    {uploadedMeta.whenText &&
                                        ` · ${uploadedMeta.whenText}`}
                                </div>
                            )}

                            {/* Asset status row */}
                            {activeAsset && (
                                <div
                                    style={{
                                        fontSize: "0.8rem",
                                        color: "#e5e7eb",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.4rem",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <span style={{ fontWeight: 500 }}>
                                        Status:
                                    </span>
                                    {isOwnerOfActiveAssetProject ? (
                                        <select
                                            value={
                                                activeAsset.status ||
                                                "needs_feedback"
                                            }
                                            onChange={(e) =>
                                                handleChangeAssetStatus(
                                                    activeAsset,
                                                    e.target.value
                                                )
                                            }
                                            style={{
                                                fontSize: "0.78rem",
                                                padding: "0.2rem 0.4rem",
                                                borderRadius: "6px",
                                                border:
                                                    "1px solid rgba(55,65,81,0.9)",
                                                backgroundColor:
                                                    "rgba(17,24,39,0.98)",
                                                color: "#e5e7eb",
                                            }}
                                        >
                                            {ASSET_STATUS_OPTIONS.map(
                                                (opt) => (
                                                    <option
                                                        key={opt.value}
                                                        value={opt.value}
                                                    >
                                                        {opt.label}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    ) : (
                                        <span>
                                            {getAssetStatusLabel(
                                                activeAsset.status
                                            )}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* AI suggestions panel
                            {aiSuggestions && showAi && (
                                <div
                                    style={{
                                        borderRadius: "8px",
                                        border:
                                            "1px solid rgba(30,64,175,0.85)",
                                        padding: "0.45rem 0.55rem",
                                        fontSize: "0.78rem",
                                        background:
                                            "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.9))",
                                        maxHeight: "28%",
                                        overflowY: "auto",
                                    }}
                                >
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            marginBottom: "0.25rem",
                                            fontSize: "0.8rem",
                                            color: "#e5e7eb",
                                        }}
                                    >
                                        Automated visual review
                                    </div>
                                    <ul
                                        style={{
                                            paddingLeft: "1rem",
                                            margin: 0,
                                            color: "#cbd5f5",
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
                            )} */}

                            {/* Comments list */}
                            <div
                                style={{
                                    flexGrow: 1,
                                    minHeight: 0,
                                    overflowY: "auto",
                                    paddingRight: "0.25rem",
                                    borderRadius: "8px",
                                    border:
                                        "1px solid rgba(31,41,55,0.95)",
                                    padding: "0.4rem",
                                    fontSize: "0.85rem",
                                    backgroundColor: "rgba(15,23,42,0.9)",
                                }}
                            >
                                {loadingComments ? (
                                    <p
                                        style={{
                                            margin: 0,
                                            color: "#9ca3af",
                                        }}
                                    >
                                        Loading comments...
                                    </p>
                                ) : commentTree.length === 0 ? (
                                    <p
                                        style={{
                                            margin: 0,
                                            color: "#9ca3af",
                                        }}
                                    >
                                        No comments yet. Start the
                                        discussion.
                                    </p>
                                ) : (
                                    commentTree.map((comment) =>
                                        renderCommentNode(comment, 0)
                                    )
                                )}
                            </div>

                            {/* Reply context */}
                            {replyTo && (
                                <div
                                    style={{
                                        marginTop: "0.3rem",
                                        marginBottom: "0.1rem",
                                        fontSize: "0.8rem",
                                        color: "#e5e7eb",
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                    }}
                                >
                                    <span>
                                        Replying to{" "}
                                        <strong>
                                            {replyTo.user?.display_name ||
                                                replyTo.user?.email ||
                                                "comment"}
                                        </strong>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setReplyTo(null)}
                                        style={{
                                            border: "none",
                                            background: "transparent",
                                            fontSize: "0.75rem",
                                            color: "#9ca3af",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}

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
                                        borderRadius: "6px",
                                        border:
                                            "1px solid rgba(55,65,81,0.9)",
                                        fontSize: "0.85rem",
                                        backgroundColor:
                                            "rgba(15,23,42,0.95)",
                                        color: "#e5e7eb",
                                    }}
                                />
                                <button
                                    type="submit"
                                    disabled={
                                        submittingComment ||
                                        !newComment.trim()
                                    }
                                    style={{
                                        padding: "0.35rem 0.8rem",
                                        borderRadius: "999px",
                                        border: "none",
                                        fontSize: "0.8rem",
                                        cursor:
                                            submittingComment ||
                                                !newComment.trim()
                                                ? "default"
                                                : "pointer",
                                        background:
                                            "linear-gradient(135deg,#1d4ed8,#2563eb)",
                                        color: "#ffffff",
                                        opacity:
                                            submittingComment ||
                                                !newComment.trim()
                                                ? 0.7
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
                        background:
                            "radial-gradient(circle at top, rgba(37,99,235,0.25), transparent 55%), rgba(0,0,0,0.7)",
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
                            background:
                                "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.96))",
                            borderRadius: "16px",
                            padding: "0.9rem",
                            boxShadow: "0 24px 60px rgba(0,0,0,0.9)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem",
                            border: "1px solid rgba(30,64,175,0.8)",
                            color: "#e5e7eb",
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
                                    color: "#9ca3af",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div
                            style={{
                                fontSize: "0.8rem",
                                color: "#9ca3af",
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
                                                    "1px solid rgba(31,41,55,0.9)",
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
