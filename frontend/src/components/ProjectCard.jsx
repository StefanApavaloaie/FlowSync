import React from "react";
import ProjectActionsMenu from "./ProjectsActionMenu";
import { getFileInfo, getAssetStatusLabel } from "../utils/helpers";

export default function ProjectCard({
    project,
    isOwned = false,
    isShared = false,
    isArchived = false,
    assets = [],
    inviteEmail = "",
    uploadingFor = null,
    onUpdateDeadline,
    onFileChange,
    onLoadAssets,
    onRename,
    onArchiveToggle,
    onDelete,
    onLeave,
    onInviteChange,
    onInvite,
    onOpenActivityLog,
    onOpenAssetViewer
}) {
    const archived = isArchived || project.is_archived;

    return (
        <div
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
                                onUpdateDeadline(
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
                        onChange={(e) => onFileChange(project.id, e)}
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
                        onRefreshAssets={() => onLoadAssets(project.id)}
                        onRename={() => onRename(project)}
                        onArchive={() => onArchiveToggle(project, !archived)}
                        onDelete={() => onDelete(project.id)}
                    />
                )}

                {isShared && (
                    <button
                        onClick={() => onLeave(project.id)}
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
                            onInviteChange(project.id, e.target.value)
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
                        onClick={() => onInvite(project.id)}
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
                    onClick={() => onOpenActivityLog(project)}
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
                        
                        // Use correct semantic colors mapping for pill-shaped statuses
                        const statusMapping = {
                            needs_feedback: { bg: "rgba(234, 179, 8, 0.2)", color: "#fef08a" },
                            in_progress: { bg: "rgba(59, 130, 246, 0.2)", color: "#bfdbfe" },
                            changes_requested: { bg: "rgba(248, 113, 113, 0.2)", color: "#fecaca"},
                            final: { bg: "rgba(34, 197, 94, 0.2)", color: "#bbf7d0" },
                        };
                        const styling = statusMapping[asset.status] || statusMapping["needs_feedback"];

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
                                        // Need to use env var or relative path ideally, but keeping as is for safety
                                        src={asset.file_path.startsWith('http') ? asset.file_path : `http://localhost:8000/uploads/${asset.file_path}`}
                                        alt={`Asset ${asset.id}`}
                                        onClick={() =>
                                            onOpenAssetViewer(asset)
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
                                            onOpenAssetViewer(asset)
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
                                        padding: "0.15rem 0.25rem",
                                        borderTop:
                                            "1px solid rgba(31,41,55,0.9)",
                                        fontSize: "0.65rem",
                                        textAlign: "center",
                                        backgroundColor: styling.bg,
                                        color: styling.color,
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
}
