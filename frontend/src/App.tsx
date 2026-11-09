import { useEffect, useState } from "react";
import { api, isAborted, messageOf } from "./api";
import AuthPanel from "./AuthPanel";
import Workspace from "./Workspace";
import type { User } from "./types";

export default function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("taskflow_token") || "",
  );
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  function logout() {
    sessionStorage.removeItem("taskflow_token");
    setToken("");
    setUser(null);
    setError("");
  }
  useEffect(() => {
    const expired = () => {
      logout();
      setNotice("로그인이 만료되었습니다. 다시 로그인해 주세요.");
    };
    window.addEventListener("taskflow:expired", expired);
    return () => window.removeEventListener("taskflow:expired", expired);
  }, []);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setError("");
    api<User>("/auth/me", token, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setUser(result);
      })
      .catch((err) => {
        if (!isAborted(err) && !controller.signal.aborted)
          setError(messageOf(err));
      });
    return () => controller.abort();
  }, [token, attempt]);
  if (!token)
    return (
      <AuthPanel
        notice={notice}
        onAuthenticated={(value) => {
          sessionStorage.setItem("taskflow_token", value);
          setToken(value);
          setNotice("");
        }}
      />
    );
  if (!user)
    return (
      <main className="session-state">
        <span className="brand-mark">t.</span>
        {error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <button
              className="primary"
              onClick={() => setAttempt((v) => v + 1)}
            >
              다시 시도
            </button>
            <button className="secondary" onClick={logout}>
              로그인으로 돌아가기
            </button>
          </>
        ) : (
          <p role="status">워크스페이스를 준비하는 중…</p>
        )}
      </main>
    );
  return <Workspace token={token} user={user} onLogout={logout} />;
}
