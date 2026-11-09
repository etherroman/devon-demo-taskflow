import { useEffect, useState } from "react";
import { api, isAborted, messageOf } from "./api";
import ItemEditor from "./ItemEditor";
import Pagination from "./Pagination";
import { statusLabels } from "./types";
import type { ItemInput, Page, Project, Status, Task } from "./types";

export default function TaskPanel({
  project,
  token,
}: {
  project: Project;
  token: string;
}) {
  const [data, setData] = useState<Page<Task> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | "">("");
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const base = `/projects/${project.id}/tasks`;
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), page_size: "5" });
    if (status) query.set("status", status);
    api<Page<Task>>(`${base}?${query}`, token, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.items.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setData(result);
      })
      .catch((err) => {
        if (!isAborted(err) && !controller.signal.aborted)
          setError(messageOf(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [base, token, page, status, version]);

  async function save(input: ItemInput) {
    setBusy(true);
    setMutationError("");
    try {
      await api(
        editing && editing !== "new" ? `${base}/${editing.id}` : base,
        token,
        {
          method: editing === "new" ? "POST" : "PATCH",
          body: JSON.stringify(input),
        },
      );
      setEditing(null);
      refresh();
    } catch (err) {
      setMutationError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(task: Task, value: Status) {
    setBusy(true);
    setMutationError("");
    try {
      await api(`${base}/${task.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      });
      refresh();
    } catch (err) {
      setMutationError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setMutationError("");
    try {
      await api(`${base}/${deleting.id}`, token, { method: "DELETE" });
      setDeleting(null);
      refresh();
    } catch (err) {
      setMutationError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="task-panel" aria-label="작업 목록">
      <div className="task-toolbar">
        <div>
          <h2>
            프로젝트의 작업 <span className="count">{data?.total ?? "–"}</span>
          </h2>
          <p className="muted">다음으로 할 일을 하나씩 정리하세요.</p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            setEditing("new");
            setMutationError("");
            setDeleting(null);
          }}
        >
          + 작업 추가
        </button>
      </div>
      <div className="filter-row">
        <label htmlFor="status-filter">상태 필터</label>
        <select
          id="status-filter"
          value={status}
          disabled={busy}
          onChange={(e) => {
            setStatus(e.target.value as Status | "");
            setPage(1);
          }}
        >
          <option value="">모든 상태</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="muted">페이지당 5개</span>
      </div>
      {editing && (
        <ItemEditor
          key={editing === "new" ? "new" : editing.id}
          kind="작업"
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
        <p className="error" role="alert">
          {mutationError}
        </p>
      )}
      {deleting && (
        <div className="confirm" role="alert">
          <p>‘{deleting.title}’ 작업을 삭제할까요?</p>
          <div className="form-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              취소
            </button>
            <button className="danger" disabled={busy} onClick={remove}>
              작업 삭제 확인
            </button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="state-box" role="status">
          작업을 불러오는 중…
        </div>
      ) : error ? (
        <div className="state-box">
          <p className="error" role="alert">
            {error}
          </p>
          <button className="secondary" onClick={refresh}>
            다시 시도
          </button>
        </div>
      ) : !data?.items.length ? (
        <div className="state-box">
          <span className="empty-icon">✓</span>
          <h3>이 조건의 작업이 없습니다.</h3>
          <p className="muted">
            새 작업을 추가하거나 다른 상태를 선택해 보세요.
          </p>
        </div>
      ) : (
        <div className="task-list">
          {data.items.map((task) => (
            <article
              key={task.id}
              className={`task-card ${task.status.toLowerCase()}`}
            >
              <span
                className={`task-indicator ${task.status.toLowerCase()}`}
                aria-hidden="true"
              >
                {task.status === "DONE"
                  ? "✓"
                  : task.status === "IN_PROGRESS"
                    ? "◐"
                    : "○"}
              </span>
              <div className="task-body">
                <h3>{task.title}</h3>
                {task.description && <p>{task.description}</p>}
                <span className="task-meta">
                  #{task.id} ·{" "}
                  {new Date(task.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <div className="task-actions">
                <select
                  aria-label={`${task.title} 상태`}
                  value={task.status}
                  disabled={busy}
                  onChange={(e) => changeStatus(task, e.target.value as Status)}
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <div>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(task);
                      setMutationError("");
                      setDeleting(null);
                    }}
                    aria-label={`${task.title} 수정`}
                  >
                    수정
                  </button>
                  <button
                    className="text-button danger-text"
                    disabled={busy}
                    onClick={() => {
                      setDeleting(task);
                      setEditing(null);
                      setMutationError("");
                    }}
                    aria-label={`${task.title} 삭제`}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {data && (
        <Pagination
          page={page}
          pageSize={5}
          total={data.total}
          disabled={loading || busy}
          onChange={setPage}
        />
      )}
    </section>
  );
}
