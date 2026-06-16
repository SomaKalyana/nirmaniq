import React, { useState, useEffect } from 'react';
import ProjectRegistration from './ProjectRegistration.jsx';
import styles from './ProjectSelect.module.css';
import { getProject } from '../utils/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Project hierarchy tree node
// ─────────────────────────────────────────────────────────────────────────────
function ProjectNode({ project, onSelect, isActive = false }) {
    return (
        <button
            className={`${styles.treeNode} ${isActive ? styles.treeNodeActive : ''}`}
            onClick={() => onSelect(project)}
        >
            <div className={styles.treeIconWrap}>
                <div className={styles.treeIcon}>🏗</div>
            </div>
            <div className={styles.treeInfo}>
                <div className={styles.treeName}>{project.name || 'Unnamed Project'}</div>
                <div className={styles.treeMeta}>
                    {[
                        project.dimensions || (project.plotLength && `${project.plotLength}×${project.plotWidth} ft`),
                        project.facing && `${project.facing} facing`,
                        project.floorConfig,
                        project.locality,
                    ].filter(Boolean).join(' · ')}
                </div>
                {project.createdAt && (
                    <div className={styles.treeDate}>
                        Created {new Date(project.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                )}
            </div>
            <div className={styles.treeArrow}>›</div>
        </button>
    );
}

function NewProjectNode({ onClick, isExpanded }) {
    return (
        <button
            className={`${styles.treeNodeNew} ${isExpanded ? styles.treeNodeNewActive : ''}`}
            onClick={onClick}
        >
            <div className={styles.treeIconWrap}>
                <div className={styles.treeIconNew}>+</div>
            </div>
            <div className={styles.treeInfo}>
                <div className={styles.treeNameNew}>New project</div>
                <div className={styles.treeMeta}>Create a new construction project</div>
            </div>
            <div className={styles.treeArrow} style={{ color: 'var(--accent)' }}>
                {isExpanded ? '▲' : '▼'}
            </div>
        </button>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProjectSelect({ user, onProjectSelected }) {
    const [existingProject, setExistingProject] = useState(null);
    const [showCreate,      setShowCreate]      = useState(false);
    const [loading,         setLoading]         = useState(true);

    useEffect(() => {
        getProject()
            .then(p => setExistingProject(p))
            .catch(err => console.warn('Failed to load project:', err))
            .finally(() => setLoading(false));
    }, []);

    const handleProjectSaved = (p) => {
        setExistingProject(p);
        onProjectSelected(p);
    };

    if (loading) {
        return (
            <div className={styles.wrap}>
                <div className={styles.loadWrap}>
                    <div className={styles.loadSpinner} />
                    <span>Loading projects…</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.wrap}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.logoMark}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="14" width="4" height="8" rx="1" fill="var(--accent)"/>
                        <rect x="8" y="10" width="4" height="12" rx="1" fill="var(--accent)" opacity=".75"/>
                        <rect x="14" y="6" width="4" height="16" rx="1" fill="var(--accent)" opacity=".5"/>
                        <rect x="20" y="2" width="2" height="20" rx="1" fill="var(--accent)" opacity=".25"/>
                    </svg>
                </div>
                <div>
                    <h1 className={styles.greeting}>
                        Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                    </h1>
                    <p className={styles.subtext}>Select a project to open, or create a new one below.</p>
                </div>
            </div>

            {/* Project tree */}
            <div className={styles.treeWrap}>
                {/* Tree header */}
                <div className={styles.treeHeader}>
                    <div className={styles.treeHeaderIcon}>📁</div>
                    <div className={styles.treeHeaderLabel}>
                        My Projects
                        <span className={styles.treeCount}>
                            {existingProject ? 1 : 0} project{existingProject ? '' : 's'}
                        </span>
                    </div>
                </div>

                <div className={styles.treeRoot}>
                    {/* Root node — owner */}
                    <div className={styles.treeOwnerNode}>
                        <div className={styles.treeOwnerIcon}>👤</div>
                        <div className={styles.treeOwnerName}>{user?.name || user?.email || 'Owner'}</div>
                    </div>

                    {/* Existing project(s) */}
                    <div className={styles.treeBranch}>
                        <div className={styles.treeBranchLine} />
                        <div className={styles.treeBranchChildren}>

                            {existingProject && (
                                <div className={styles.treeNodeWrap}>
                                    <div className={styles.treeConnector} />
                                    <ProjectNode
                                        project={existingProject}
                                        onSelect={onProjectSelected}
                                    />
                                </div>
                            )}

                            {!existingProject && (
                                <div className={styles.treeEmpty}>
                                    <div className={styles.treeConnector} />
                                    <div className={styles.treeEmptyNode}>
                                        No projects yet — create your first one below
                                    </div>
                                </div>
                            )}

                            {/* New project node */}
                            <div className={styles.treeNodeWrap}>
                                <div className={styles.treeConnectorLast} />
                                <NewProjectNode
                                    onClick={() => setShowCreate(v => !v)}
                                    isExpanded={showCreate}
                                />
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* Inline project registration */}
            {showCreate && (
                <div className={styles.createWrap}>
                    <div className={styles.createHeader}>
                        <div className={styles.createHeaderLeft}>
                            <div className={styles.createHeaderIcon}>📋</div>
                            <div>
                                <div className={styles.createHeaderTitle}>New Project Registration</div>
                                <div className={styles.createHeaderSub}>Fill in the details to create your project</div>
                            </div>
                        </div>
                        <button
                            className={styles.createCloseBtn}
                            onClick={() => setShowCreate(false)}
                        >✕</button>
                    </div>
                    <ProjectRegistration
                        onSaved={handleProjectSaved}
                        onCancel={() => setShowCreate(false)}
                    />
                </div>
            )}
        </div>
    );
}
