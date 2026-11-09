export default function Pagination({
  page,
  pageSize,
  total,
  onChange,
  disabled,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  disabled: boolean;
}) {
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav className="pagination" aria-label="페이지 이동">
      <button
        className="secondary"
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
      >
        이전
      </button>
      <span>
        {page} / {maxPage}
      </span>
      <button
        className="secondary"
        disabled={disabled || page >= maxPage}
        onClick={() => onChange(page + 1)}
      >
        다음
      </button>
    </nav>
  );
}
