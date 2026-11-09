export const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:8001"
).replace(/\/$/, "");
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new Error(
      "서버에 연결하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.",
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail
              .map(
                (v: { loc?: string[]; msg?: string }) =>
                  `${v.loc?.slice(1).join(".") || "입력"}: ${v.msg || "올바르지 않은 값"}`,
              )
              .join(" / ")
          : `요청을 처리하지 못했습니다 (${response.status}).`;
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("taskflow:expired"));
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "다시 시도해 주세요.";
export const isAborted = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";
