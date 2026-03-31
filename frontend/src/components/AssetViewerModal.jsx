import React from "react";
import { REACTION_EMOJIS, ASSET_STATUS_OPTIONS, getAssetStatusLabel } from "../utils/helpers";

export default function AssetViewerModal({
    activeAsset,
    setActiveAsset,
    activeFileInfo,
    isOwnerOfActiveAssetProject,
    uploadedMeta,
    commentTree,
    newComment,
    setNewComment,
    submittingComment,
    loadingComments,
    replyTo,
    setReplyTo,
    handleDeleteAsset,
    handleChangeAssetStatus,
    handlePostComment,
    handleToggleReaction,
    handleDeleteComment,
    user
}) {
    if (!activeAsset) return null;

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

    return (
        <div
            onClick={() => setActiveAsset(null)}
            style={{
                position: "fixed", 
                inset: 0,
                backgroundColor: "rgba(2, 6, 23, 0.8)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
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
                        border:
                            "1px solid rgba(31,41,55,0.95)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background:
                            "radial-gradient(circle at top left, rgba(30,64,175,0.22), transparent 55%), #020617",
                    }}
                >
                    {activeFileInfo && activeFileInfo.kind === "image" ? (
                        <img
                            src={activeAsset.file_path.startsWith('http') ? activeAsset.file_path : `http://localhost:8000/uploads/${activeAsset.file_path}`}
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
                                href={activeAsset.file_path.startsWith('http') ? activeAsset.file_path : `http://localhost:8000/uploads/${activeAsset.file_path}`}
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

                {/* RIGHT: comments */}
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

                    <div
                        style={{
                            flexGrow: 1,
                            overflowY: "auto",
                            marginTop: "0.2rem",
                            paddingRight: "0.3rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.6rem",
                        }}
                    >
                        {loadingComments ? (
                            <div style={{ fontSize: "0.8rem" }}>
                                Loading comments...
                            </div>
                        ) : commentTree.length === 0 ? (
                            <div
                                style={{
                                    fontSize: "0.85rem",
                                    color: "#9ca3af",
                                    padding: "1rem",
                                    textAlign: "center",
                                    border:
                                        "1px dashed rgba(55,65,81,0.9)",
                                    borderRadius: "10px",
                                }}
                            >
                                No comments yet. Be the first to
                                share thoughts!
                            </div>
                        ) : (
                            commentTree.map((root) =>
                                renderCommentNode(root, 0)
                            )
                        )}
                    </div>

                    {/* Post comment form */}
                    <div
                        style={{
                            marginTop: "0.5rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.25rem",
                        }}
                    >
                        {replyTo && (
                            <div
                                style={{
                                    fontSize: "0.75rem",
                                    color: "#93c5fd",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    background: "rgba(30,64,175,0.25)",
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "4px",
                                }}
                            >
                                <span>
                                    Replying to{" "}
                                    {replyTo.user?.display_name ||
                                        replyTo.user?.email ||
                                        "Unknown"}
                                </span>
                                <button
                                    onClick={() => setReplyTo(null)}
                                    style={{
                                        border: "none",
                                        background: "transparent",
                                        color: "#9ca3af",
                                        cursor: "pointer",
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            style={{
                                flexGrow: 1,
                                height: "3.2rem",
                                padding: "0.4rem 0.6rem",
                                borderRadius: "8px",
                                border:
                                    "1px solid rgba(55,65,81,0.9)",
                                background: "rgba(15,23,42,0.92)",
                                color: "#f9fafb",
                                fontSize: "0.85rem",
                                outline: "none",
                                resize: "none",
                            }}
                        />
                        <button
                            type="button"
                            onClick={handlePostComment}
                            disabled={
                                submittingComment ||
                                !newComment.trim()
                            }
                            style={{
                                padding: "0.35rem 0.8rem",
                                borderRadius: "8px",
                                border: "none",
                                background:
                                    "linear-gradient(135deg, #2563eb, #0ea5e9)",
                                color: "#ffffff",
                                cursor:
                                    submittingComment ||
                                        !newComment.trim()
                                        ? "default"
                                        : "pointer",
                                opacity:
                                    submittingComment ||
                                        !newComment.trim()
                                        ? 0.5
                                        : 1,
                                fontSize: "0.85rem",
                                fontWeight: 500,
                            }}
                        >
                            {submittingComment ? "Posting..." : "Post"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
