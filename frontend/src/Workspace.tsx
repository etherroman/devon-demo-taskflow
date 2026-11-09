import { useEffect, useState } from "react";
import { api, isAborted, messageOf } from "./api";
import ItemEditor from "./ItemEditor";
import Pagination from "./Pagination";
import TaskPanel from "./TaskPanel";
import type { ItemInput, Page, Project, User } from "./types";

export default function Workspace({
  token,
  user,
  onLogout,
}: {
  token: string;
  user: User;
  onLogout: () => void;
}) {
  const [projects, setProjects] = useState<Page<Project> | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Project | "new" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api<Page<Project>>(`/projects?page=${page}&page_size=5`, token, {
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (!result.items.length && page > 1) {
          setPage(page - 1);
          return;
        }
        setProjects(result);
        setSelected(
          (current) =>
            result.items.find((item) => item.id === current?.id) ||
            result.items[0] ||
            null,
        );
      })
      .catch((err) => {
        if (!isAborted(err) && !controller.signal.aborted)
          setError(messageOf(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, page, version]);
  async function save(input: ItemInput) {
    setBusy(true);
    setMutationError("");
    try {
      const item = await api<Project>(
        editing && editing !== "new" ? `/projects/${editing.id}` : "/projects",
        token,
        {
          method: editing === "new" ? "POST" : "PATCH",
          body: JSON.stringify(input),
        },
      );
      // Project creation jumps to the final page where the newly created item is visible.
      if (editing === "new")
        setPage(Math.ceil(((projects?.total || 0) + 1) / 5));
      setSelected(item);
      setEditing(null);
      refresh();
    } catch (err) {
      setMutationError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected) return;
    setBusy(true);
    setMutationError("");
    try {
      await api(`/projects/${selected.id}`, token, { method: "DELETE" });
      setDeleting(false);
      setSelected(null);
      refresh();
    } catch (err) {
      setMutationError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  function selectProject(project: Project) {
    setSelected(project);
    setEditing(null);
    setDeleting(false);
    setMutationError("");
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Taskflow 홈">
          <span className="brand-mark">t.</span>taskflow
          <span className="brand-dot">●</span>
        </a>
        <div className="workspace-label">
          <span className="avatar">{user.email.charAt(0).toUpperCase()}</span>
          <div>
            <strong>나의 워크스페이스</strong>
            <small>Personal workspace</small>
          </div>
        </div>
        <div className="sidebar-heading">
          <span>프로젝트</span>
          <span>{projects?.total ?? "–"}</span>
        </div>
        <button
          className="new-project"
          disabled={busy}
          onClick={() => {
            setEditing("new");
            setDeleting(false);
            setMutationError("");
          }}
        >
          + 새 프로젝트
        </button>
        {loading ? (
          <p className="sidebar-state" role="status">
            불러오는 중…
          </p>
        ) : error ? (
          <div className="sidebar-state">
            <p role="alert">{error}</p>
            <button className="secondary" onClick={refresh}>
              다시 시도
            </button>
          </div>
        ) : !projects?.items.length ? (
          <p className="sidebar-state">아직 프로젝트가 없습니다.</p>
        ) : (
          <nav className="project-list" aria-label="프로젝트 선택">
            {projects.items.map((project, index) => (
              <button
                key={project.id}
                className={selected?.id === project.id ? "active" : ""}
                onClick={() => selectProject(project)}
                disabled={busy}
              >
                <span className={`project-symbol color-${index % 3}`}>▤</span>
                <span>{project.title}</span>
                <span className="project-arrow">↗</span>
              </button>
            ))}
          </nav>
        )}
        {projects && (
          <Pagination
            page={page}
            pageSize={5}
            total={projects.total}
            disabled={loading || busy}
            onChange={(value) => {
              setPage(value);
              setEditing(null);
              setDeleting(false);
            }}
          />
        )}
        <div className="sidebar-bottom">
          <p>작은 진전도, 분명한 진전.</p>
          <span>천천히, 꾸준히 나아가세요.</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb-slash">/</span>{" "}
            <strong>프로젝트</strong>
          </span>
          <div className="account">
            <span>{user.email}</span>
            <button className="secondary" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </header>
        <main className="workspace-main">
          <div className="page-intro">
            <p className="eyebrow">MAKE ROOM FOR PROGRESS</p>
            <h1>오늘도, 하나씩.</h1>
            <p className="muted">
              집중할 일을 정하고 나만의 속도로 진행하세요.
            </p>
          </div>
          {editing && (
            <ItemEditor
              key={editing === "new" ? "new-project" : editing.id}
              kind="프로젝트"
              item={editing === "new" ? undefined : editing}
              busy={busy}
              error={mutationError}
              onSave={save}
              onCancel={() => {
                setEditing(null);
                setMutationError("");
              }}
            />
          )}
          {mutationError && !editing && (
            <p role="alert" className="error">
              {mutationError}
            </p>
          )}
          {selected ? (
            <>
              <section className="project-summary">
                <div className="project-cover-icon">▤</div>
                <div className="project-summary-body">
                  <p className="eyebrow">YOUR PROJECT</p>
                  <h2>{selected.title}</h2>
                  <p>
                    {selected.description ||
                      "이 프로젝트의 설명을 추가해 보세요."}
                  </p>
                </div>
                <div className="project-controls">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditing(selected);
                      setDeleting(false);
                      setMutationError("");
                    }}
                  >
                    프로젝트 수정
                  </button>
                  <button
                    className="text-button danger-text"
                    disabled={busy}
                    onClick={() => {
                      setDeleting(true);
                      setEditing(null);
                      setMutationError("");
                    }}
                  >
                    프로젝트 삭제
                  </button>
                </div>
              </section>
              {deleting && (
                <div className="confirm" role="alert">
                  <h3>프로젝트를 삭제할까요?</h3>
                  <p>‘{selected.title}’와 포함된 모든 작업이 삭제됩니다.</p>
                  <div className="form-actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setDeleting(false)}
                    >
                      취소
                    </button>
                    <button className="danger" disabled={busy} onClick={remove}>
                      프로젝트 삭제 확인
                    </button>
                  </div>
                </div>
              )}
              <TaskPanel key={selected.id} project={selected} token={token} />
            </>
          ) : (
            !loading &&
            !error && (
              <div className="welcome-empty">
                <span className="empty-icon">▤</span>
                <h2>첫 프로젝트를 시작해 보세요.</h2>
                <p className="muted">큰 목표도 작은 작업부터 시작됩니다.</p>
                <button className="primary" onClick={() => setEditing("new")}>
                  + 프로젝트 만들기
                </button>
              </div>
            )
          )}
        </main>
        <footer className="app-footer">
          Taskflow <span>작업에 집중할 수 있는 작은 공간.</span>
        </footer>
      </div>
    </div>
  );
}
