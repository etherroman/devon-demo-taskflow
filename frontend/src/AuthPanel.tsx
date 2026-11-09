import { useState } from "react";
import type { FormEvent } from "react";
import { api, messageOf } from "./api";

export default function AuthPanel({
  onAuthenticated,
  notice,
}: {
  onAuthenticated: (token: string) => void;
  notice: string;
}) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = JSON.stringify({ email: email.trim(), password });
      if (signup)
        await api("/auth/signup", undefined, { method: "POST", body });
      const data = await api<{ access_token: string }>(
        "/auth/login",
        undefined,
        { method: "POST", body },
      );
      onAuthenticated(data.access_token);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <a className="brand" href="/" aria-label="Taskflow 홈">
          <span className="brand-mark">t.</span>taskflow
          <span className="brand-dot">●</span>
        </a>
        <div>
          <p className="eyebrow">A LITTLE CLARITY, EVERY DAY</p>
          <h1>
            작은 할 일에서,
            <br />
            다음 가능성까지.
          </h1>
          <p className="story-copy">
            생각은 가볍게, 실행은 명확하게.
            <br />
            프로젝트와 작업을 한곳에서 정리하세요.
          </p>
        </div>
        <div className="story-card">
          <span className="mini-check">✓</span>
          <div>
            <strong>하나씩 끝내는 즐거움</strong>
            <p>오늘의 작은 진전이 내일의 큰 변화를 만듭니다.</p>
          </div>
        </div>
        <p className="story-footer">YOUR SPACE TO MAKE THINGS HAPPEN.</p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <span className="pill">PROJECT & TASK MANAGER</span>
          <h2>{signup ? "새로운 시작" : "다시 만나 반가워요"}</h2>
          <p className="muted">
            {signup
              ? "나만의 작업 공간을 만들어 보세요."
              : "이어서 나의 프로젝트를 진행해 보세요."}
          </p>
          <form onSubmit={submit} className="stack auth-form">
            <label>
              이메일
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
                disabled={busy}
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? "new-password" : "current-password"}
                placeholder="10자 이상 입력"
                minLength={10}
                maxLength={128}
                required
                disabled={busy}
              />
            </label>
            {signup && (
              <p className="field-hint">비밀번호는 10~128자로 입력해 주세요.</p>
            )}
            {(error || notice) && (
              <p role="alert" className="error">
                {error || notice}
              </p>
            )}
            <button className="primary large" disabled={busy}>
              {busy ? "처리 중…" : signup ? "회원가입" : "로그인"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
          <p className="auth-switch">
            {signup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"}{" "}
            <button
              className="text-button"
              aria-label={signup ? "로그인으로 전환" : "회원가입으로 전환"}
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setError("");
              }}
            >
              {signup ? "로그인" : "회원가입"}
            </button>
          </p>
          <div className="demo-note">
            <strong>먼저 둘러보고 싶다면</strong>
            <p>
              시드 실행 후 <code>alice@example.com</code>
              <br />
              <code>DemoPass123!</code>으로 로그인하세요.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
