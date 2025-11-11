import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

function ProjectsSection() {
    const { token } = useAuth();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [assetsByProject, setAssetsByProject] = useState({});
    const [uploadingFor, setUploadingFor] = useState(null);

    useEffect(() => {
        if (!token) return;

        setLoading(true);
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
            .finally(() => setLoading(false));
    }, [token]);

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
    useEffect(() => {
        if (!token || projects.length === 0) return;
        projects.forEach((project) => {
            loadAssets(project.id);
        });
    }, [token, projects]);
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
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
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

    if (loading) {
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

            {/* Projects list */}
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

                                {/* Upload input */}
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
                                        onClick={() => {
                                            if (!assets.length) {
                                                loadAssets(project.id);
                                            } else {
                                                // toggle clear
                                                setAssetsByProject((prev) => ({
                                                    ...prev,
                                                    [project.id]: prev[project.id],
                                                }));
                                            }
                                        }}
                                        style={{
                                            padding: "0.25rem 0.6rem",
                                            fontSize: "0.78rem",
                                            borderRadius: "4px",
                                            border: "1px solid #e5e7eb",
                                            backgroundColor: "#f9fafb",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {assets.length ? "Refresh assets" : "Load assets"}
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
                                            gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
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
                                                    style={{
                                                        width: "100%",
                                                        height: "60px",
                                                        objectFit: "cover",
                                                        display: "block",
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
        </section>
    );
}

export default ProjectsSection;
