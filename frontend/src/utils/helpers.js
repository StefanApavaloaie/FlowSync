export const REACTION_EMOJIS = ["👍", "❤️", "💡", "😂", "😮"];
export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

export const ASSET_STATUS_OPTIONS = [
    { value: "needs_feedback", label: "Needs feedback" },
    { value: "in_progress", label: "In progress" },
    { value: "changes_requested", label: "Changes requested" },
    { value: "final", label: "Final" },
];

export function getAssetStatusLabel(status) {
    const found = ASSET_STATUS_OPTIONS.find((s) => s.value === status);
    return found ? found.label : "Needs feedback";
}

export function getFileInfo(asset) {
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

export function sortProjectsBy(projects, sortOption) {
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

export function buildCommentTree(comments) {
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
}
