import { useState, useRef, useEffect } from "react";

function ProjectActionsMenu({
    onRename,
    onArchive,
    onDelete,
    archived = false,
}) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

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

    const toggleMenu = () => setOpen(prev => !prev);

    return (
        <div className="fs-project-menu" ref={menuRef}>
            <button
                type="button"
                className="fs-project-menu-trigger"
                onClick={toggleMenu}
            >
                {open ? "Hide options ▲" : "Show options ▼"}
            </button>

            {open && (
                <div className="fs-project-menu-dropdown">
                    <button
                        type="button"
                        onClick={onRename}
                    >
                        Rename project
                    </button>
                    <button
                        type="button"
                        onClick={onArchive}
                    >
                        {archived ? "Unarchive project" : "Archive project"}
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

export default ProjectActionsMenu;
