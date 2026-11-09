import { useState } from "react";
import type { FormEvent } from "react";
import type { ItemInput, Project, Status, Task } from "./types";
import { statusLabels } from "./types";

export default function ItemEditor({
  kind,
  item,
  busy,
  error,
  onSave,
  onCancel,
}: {
  kind: "프로젝트" | "작업";
  item?: Project | Task;
  busy: boolean;
  error: string;
  onSave: (data: ItemInput) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item?.title || "");
  const [description, setDescription] = useState(item?.description || "");
  const [status, setStatus] = useState<Status>(
    item && "status" in item ? item.status : "TODO",
  );
  const [inputError, setInputError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setInputError("제목에 공백 이외의 내용을 입력해 주세요.");
      return;
    }
    setInputError("");
    onSave({
      title: title.trim(),
      description: description.trim(),
      ...(kind === "작업" ? { status } : {}),
    });
  }
  return (
    <form
      className="editor stack"
      onSubmit={submit}
      aria-label={`${kind} ${item ? "수정" : "만들기"}`}
    >
      <div className="section-row">
        <h3>
          {kind} {item ? "수정" : "만들기"}
        </h3>
        <button
          type="button"
          className="icon-button"
          aria-label="편집 닫기"
          onClick={onCancel}
          disabled={busy}
        >
          ×
        </button>
      </div>
      <label>
        {kind} 제목
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          disabled={busy}
          placeholder={`${kind}의 이름을 입력하세요`}
        />
      </label>
      <label>
        설명 <span className="muted">(선택)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          disabled={busy}
          placeholder="어떤 일을 진행하나요?"
        />
      </label>
      {kind === "작업" && (
        <label>
          작업 상태
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            disabled={busy}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {(inputError || error) && (
        <p className="error" role="alert">
          {inputError || error}
        </p>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="secondary"
          onClick={onCancel}
          disabled={busy}
        >
          취소
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
