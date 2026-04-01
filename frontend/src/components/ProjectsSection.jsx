// frontend/src/components/ProjectsSection.jsx

import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import ProjectActionsMenu from "./ProjectsActionMenu";
import ProjectCard from "./ProjectCard";
import AssetViewerModal from "./AssetViewerModal";
import ActivityLogModal from "./ActivityLogModal";
import { sortProjectsBy, buildCommentTree, getFileInfo } from "../utils/helpers";




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

    // const [aiSuggestions, setAiSuggestions] = useState(null);
    // const [loadingAi, setLoadingAi] = useState(false);
    // const [showAi, setShowAi] = useState(false);

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
                // setAiSuggestions(null);
                // setShowAi(false);
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
                // setAiSuggestions(null);
                // setShowAi(false);
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
        // setAiSuggestions(null);
        // setShowAi(false);

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
            // setAiSuggestions(null);
            // setShowAi(false);
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

    /*
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
    */

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

    // ---- rendering helpers ----

    if (loadingProjects) {
        return (
            <section className="fs-section-projects">
                <p style={{ color: "#9ca3af" }}>Loading projects...</p>
            </section>
        );
    }

    
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

    const commentTree = buildCommentTree(comments);

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
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isOwned={true}
                                assets={assetsByProject[project.id]}
                                inviteEmail={inviteEmails[project.id]}
                                uploadingFor={uploadingFor}
                                onUpdateDeadline={handleUpdateProjectDeadline}
                                onFileChange={handleFileChange}
                                onLoadAssets={loadAssets}
                                onRename={handleRenameProject}
                                onArchiveToggle={handleArchiveToggle}
                                onDelete={handleDeleteProject}
                                onLeave={handleLeaveProject}
                                onInviteChange={handleInviteChange}
                                onInvite={handleInvite}
                                onOpenActivityLog={openActivityLog}
                                onOpenAssetViewer={openAssetViewer}
                            />
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
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isOwned={true} isArchived={true}
                                assets={assetsByProject[project.id]}
                                inviteEmail={inviteEmails[project.id]}
                                uploadingFor={uploadingFor}
                                onUpdateDeadline={handleUpdateProjectDeadline}
                                onFileChange={handleFileChange}
                                onLoadAssets={loadAssets}
                                onRename={handleRenameProject}
                                onArchiveToggle={handleArchiveToggle}
                                onDelete={handleDeleteProject}
                                onLeave={handleLeaveProject}
                                onInviteChange={handleInviteChange}
                                onInvite={handleInvite}
                                onOpenActivityLog={openActivityLog}
                                onOpenAssetViewer={openAssetViewer}
                            />
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
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isShared={true}
                                assets={assetsByProject[project.id]}
                                inviteEmail={inviteEmails[project.id]}
                                uploadingFor={uploadingFor}
                                onUpdateDeadline={handleUpdateProjectDeadline}
                                onFileChange={handleFileChange}
                                onLoadAssets={loadAssets}
                                onRename={handleRenameProject}
                                onArchiveToggle={handleArchiveToggle}
                                onDelete={handleDeleteProject}
                                onLeave={handleLeaveProject}
                                onInviteChange={handleInviteChange}
                                onInvite={handleInvite}
                                onOpenActivityLog={openActivityLog}
                                onOpenAssetViewer={openAssetViewer}
                            />
                        )}
                    </div>
                )}
            </div>

        
            <AssetViewerModal
                activeAsset={activeAsset}
                setActiveAsset={setActiveAsset}
                activeFileInfo={activeFileInfo}
                isOwnerOfActiveAssetProject={isOwnerOfActiveAssetProject}
                uploadedMeta={uploadedMeta}
                commentTree={commentTree}
                newComment={newComment}
                setNewComment={setNewComment}
                submittingComment={submittingComment}
                loadingComments={loadingComments}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                handleDeleteAsset={handleDeleteAsset}
                handleChangeAssetStatus={handleChangeAssetStatus}
                handlePostComment={submitComment}
                handleToggleReaction={handleToggleReaction}
                handleDeleteComment={handleDeleteComment}
                user={user}
            />

            <ActivityLogModal
                activityProject={activityProject}
                loadingActivity={loadingActivity}
                activityItems={activityItems}
                closeActivityLog={closeActivityLog}
            />
        </section>
    );
}

export default ProjectsSection;
