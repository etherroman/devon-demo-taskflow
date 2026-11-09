import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const page = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 5,
});
const project = {
  id: 1,
  title: "서비스 출시 준비",
  description: "팀의 첫 출시",
  created_at: "2026-11-09T00:00:00Z",
};
const task = {
  id: 2,
  project_id: 1,
  title: "API 검토",
  description: "계약 확인",
  status: "TODO",
  created_at: "2026-11-09T00:00:00Z",
};
function mockApi(
  handler: (url: string, init?: RequestInit) => [number, unknown],
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const [status, data] = handler(url, init);
      return { ok: status < 400, status, json: async () => data };
    }),
  );
}
afterEach(() => vi.unstubAllGlobals());

describe("Taskflow user journeys", () => {
  it("shows login API errors and leaves credentials editable", async () => {
    mockApi(() => [401, { detail: "Invalid email or password" }]);
    render(<App />);
    await userEvent.type(screen.getByLabelText("이메일"), "alice@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "WrongPass123!");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  });

  it("signs up then logs in and opens the owner workspace", async () => {
    mockApi((url) => {
      if (url.endsWith("/signup"))
        return [201, { id: 1, email: "new@example.com" }];
      if (url.endsWith("/login")) return [200, { access_token: "demo-token" }];
      if (url.endsWith("/me"))
        return [200, { id: 1, email: "new@example.com" }];
      return [200, page([])];
    });
    render(<App />);
    await userEvent.click(
      screen.getByRole("button", { name: "회원가입으로 전환" }),
    );
    await userEvent.type(screen.getByLabelText("이메일"), "new@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "DemoPass123!");
    await userEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(await screen.findByText("new@example.com")).toBeInTheDocument();
    expect(
      await screen.findByText("아직 프로젝트가 없습니다."),
    ).toBeInTheDocument();
  });

  it("loads projects and sends status filtering to the API", async () => {
    sessionStorage.setItem("taskflow_token", "demo-token");
    mockApi((url) => {
      if (url.endsWith("/me"))
        return [200, { id: 1, email: "alice@example.com" }];
      if (url.includes("/tasks"))
        return [200, page(url.includes("status=DONE") ? [] : [task])];
      return [200, page([project])];
    });
    render(<App />);
    await userEvent.click(
      await screen.findByRole("button", { name: /서비스 출시 준비/ }),
    );
    expect(await screen.findByText("API 검토")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("상태 필터"), "DONE");
    expect(
      await screen.findByText("이 조건의 작업이 없습니다."),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("status=DONE"),
      expect.any(Object),
    );
  });

  it("expires an invalid session and returns to login", async () => {
    sessionStorage.setItem("taskflow_token", "expired");
    mockApi(() => [401, { detail: "Invalid or expired token" }]);
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "로그인" }),
      ).toBeInTheDocument(),
    );
    expect(sessionStorage.getItem("taskflow_token")).toBeNull();
  });
});
