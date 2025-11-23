// la începutul fișierului
import { useState, useRef, useEffect } from "react";

function ProjectActionsMenu({
    onUploadAsset,
    onRefreshAssets,
    onRename,
    onArchive,
    onDelete,
}) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    // închide meniul când dai click în afară
    useEffect(() => {
        function handleClickOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
            }
        }

        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open]);

    return (
        <div className="fs-project-menu" ref={menuRef}>
            <button
                type="button"
                className="fs-project-menu-trigger"
                onClick={() => setOpen((prev) => !prev)}
            >
                ⋯
            </button>

            {open && (
                <div className="fs-project-menu-dropdown">
                    <button type="button" onClick={onUploadAsset}>
                        Upload asset
                    </button>
                    <button type="button" onClick={onRefreshAssets}>
                        Refresh assets
                    </button>
                    <button type="button" onClick={onRename}>
                        Rename project
                    </button>
                    <button type="button" onClick={onArchive}>
                        Archive project
                    </button>
                    <button
                        type="button"
                        className="fs-project-menu-danger"
                        onClick={onDelete}
                    >
                        Delete project
                    </button>
                </div>
            )}
        </div>
    );
}
