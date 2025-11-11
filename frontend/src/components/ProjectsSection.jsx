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

    useEffect(() => {
        if (!token) return;

        setLoading(true);
        api
            .get("/projects/", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            })
            .then((res) => {
                setProjects(res.data);
            })
            .catch((err) => {
                console.error("Failed to load projects", err);
            })
            .finally(() => setLoading(false));
    }, [token]);

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
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            // Prepend new project
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
        const confirm = window.confirm("Delete this project?");
        if (!confirm) return;

        try {
            await api.delete(`/projects/${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setProjects((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            console.error("Failed to delete project", err);
            alert("Failed to delete project.");
        }
    };

    if (loading) {
        return <p>Loading projects...</p>;
    }

    return (
        <section style={{ marginTop: "1.5rem" }}>
            <h2 style={{ marginBottom: "0.75rem" }}>Projects</h2>

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
                        opacity: creating ? 0.7 : 1,
                    }}
                >
                    {creating ? "Creating..." : "Create project"}
                </button>
            </form>

            {projects.length === 0 ? (
                <p style={{ color: "#666" }}>
                    You have no projects yet. Create one to start managing design
                    feedback.
                </p>
            ) : (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: "0.75rem",
                    }}
                >
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            style={{
                                padding: "0.85rem",
                                borderRadius: "8px",
                                border: "1px solid #e0e0e0",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
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
                                    marginTop: "0.35rem",
                                    display: "flex",
                                    justifyContent: "flex-end",
                                }}
                            >
                                <button
                                    onClick={() => handleDelete(project.id)}
                                    style={{
                                        padding: "0.25rem 0.6rem",
                                        fontSize: "0.78rem",
                                        borderRadius: "4px",
                                        border: "1px solid #f0b3b3",
                                        background: "#fff5f5",
                                        cursor: "pointer",
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default ProjectsSection;
