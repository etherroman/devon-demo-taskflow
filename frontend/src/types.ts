export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type User = { id: number; email: string };
export type Project = {
  id: number;
  title: string;
  description: string;
  created_at: string;
};
export type Task = Project & { project_id: number; status: Status };
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
export type ItemInput = { title: string; description: string; status?: Status };
export const statusLabels: Record<Status, string> = {
  TODO: "할 일",
  IN_PROGRESS: "진행 중",
  DONE: "완료",
};
