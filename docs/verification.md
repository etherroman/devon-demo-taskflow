# 실제 검증 기록

검증일: 2026-11-09 (Asia/Seoul). Windows, Python 3.13.7, uv 0.11.14, Node 22.14.0, npm 11.6.2, PostgreSQL 17.6.

## 테스트 먼저 작성

API 계약 테스트 17개를 먼저 작성하고 라우터가 없는 FastAPI 앱으로 실행했다.

```text
.venv/Scripts/python.exe -m pytest -q --basetemp=.pytest-tmp-red --tb=short
17 failed: 기대한 201/401/422 대신 404 (기능 미구현)
```

구현 후 같은 테스트가 SQLite에서 17개, PostgreSQL에서 17개 통과했다. 프런트엔드 사용자 흐름 테스트도 UI 구현 전 4개 모두 로그인 폼/워크스페이스가 없어 실패하는 것을 확인했고 구현 후 4개 통과했다.

## PostgreSQL 마이그레이션과 반복 시드

기존 서비스 DB를 사용하지 않고, 별도 초기화한 PostgreSQL 17.6 클러스터의 빈 `taskflow_demo`와 `taskflow_tests` 데이터베이스에서 실행했다. 검증용 URL은 이 환경에만 존재하는 루프백 계정이며 배포 설정에 저장하지 않았다.

`backend/`에서 다음 명령을 실행했다.

```powershell
$env:DATABASE_URL = 'postgresql+psycopg://taskflow_check@127.0.0.1:55432/taskflow_demo'
$env:JWT_SECRET = 'local-check-secret-at-least-32-characters'
.venv/Scripts/alembic.exe upgrade head
.venv/Scripts/python.exe -m app.seed
.venv/Scripts/python.exe -m app.seed
.venv/Scripts/alembic.exe check
```

결과:

- 빈 DB에서 `0001_initial` 적용 성공.
- 시드 두 번 모두 종료 코드 0. SQL로 사용자/프로젝트/작업 개수 `(2, 3, 9)` 확인.
- `alembic check`: `No new upgrade operations detected.`

PostgreSQL API 테스트:

```powershell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://taskflow_check@127.0.0.1:55432/taskflow_tests'
.venv/Scripts/python.exe -m pytest -q --basetemp=.pytest-tmp-pg --tb=short
```

결과: `17 passed in 5.33s`. 테스트는 전용 DB의 테이블을 케이스마다 재생성했다. 이 과정에서 시드 DB를 변경하지 않았다.

## 실행 중 API의 HTTP 검사

`taskflow_demo`를 사용하는 Uvicorn을 8001번 포트에서 실제 실행하고 `scripts/smoke.py`를 실행했다.

```text
.venv/Scripts/python.exe scripts/smoke.py
PASS live HTTP: health, login, project/task CRUD, ownership, status/filter/page, validation
```

로그인, 프로젝트/작업 생성·조회·수정·삭제, 다른 사용자의 접근 404, 상태 변경·필터, 잘못된 페이지 422, 인증 누락 401을 실제 HTTP로 확인했다. 생성한 검사 프로젝트와 작업은 종료 시 삭제했다. `/health`는 `{"status":"ok"}`, 프런트엔드 `/`는 HTTP 200 응답을 확인했다.

## 빌드와 정적 검사

```text
backend: uv sync → 51 packages resolved (uv.lock 생성)
backend: python -m compileall -q app → exit 0
backend: ruff check app tests alembic → All checks passed!
backend: ruff format --check app tests alembic → 16 files already formatted
frontend: npm install → package-lock.json 생성
frontend: npm test → 1 test file, 4 tests passed
frontend: npm run build → TypeScript + Vite production build 성공 (23 modules)
frontend: Prettier --check → All matched files use Prettier code style!
```

프런트엔드 테스트는 실제 컴포넌트를 렌더링하고 `fetch` 경계만 대체한다. 로그인 오류, 회원가입 후 로그인과 빈 프로젝트 목록, 프로젝트/작업 목록과 상태 필터 요청, 만료 세션 초기화를 확인한다. 이 결과만으로 실제 브라우저의 DB 연결까지 검증했다고 주장하지 않는다.

## 실행 환경 제약

- 샌드박스 내 uv 캐시/pytest 임시 폴더 권한 문제를 프로젝트 내부 캐시/임시 경로로 해결했다.
- 샌드박스 내 TestClient의 스레드 시작과 네트워크 접근이 멈추어 테스트/공개 패키지 설치/루프백 서버 검증을 필요한 명령만 권한 확장하여 실행했다. 권한 확장 후 결과를 위에 기록했다.
- Docker 명령이 설치되지 않아 이미지 빌드, `docker compose config/up`, 컨테이너 healthcheck 연결은 미실행이다. Dockerfile/Compose 제공과 로컬 실행 성공을 구분한다.
- 최초 로컬 코드 검증 후 독립 Public GitHub 저장소를 생성하고 커밋·push했다. API 수집 조건은 [publication.md](publication.md)에 기록한다. 애플리케이션 공개 서버 배포는 수행하지 않았다.

## 실제 브라우저 검증

루트 작업자가 실행 중인 React 화면과 PostgreSQL/FastAPI 서버를 연결해 직접 검사했다.

- Alice 로그인, 프로젝트 생성·조회·수정·삭제, 작업 생성·조회·수정·삭제 성공.
- 작업 `TODO → IN_PROGRESS → DONE` 변경 및 새로고침 후 `DONE` 보존 확인.
- 공백 제목의 입력 오류, 빈 목록, TODO/DONE 필터, 삭제 확인 화면 확인.
- 샘플 작업의 1페이지 5개, 2페이지 2개 표시 확인.
- 브라우저 console 경고/오류 없음. 검사용 프로젝트/작업 삭제 후 샘플 데이터 유지.
- 별도 코드 리뷰에서 높은/중간 심각도 결함은 발견하지 못했다.

최종 재실행: SQLite API `17 passed in 3.02s`, PostgreSQL API `17 passed in 3.90s`, React `4 passed`, TypeScript/Vite build 종료 코드 0, Ruff 전체 `All checks passed!`, 17개 Python 파일 형식 일치. Docker 미검증 범위는 그대로다.
