# Taskflow

사용자마다 독립된 프로젝트와 작업을 관리하는 풀스택 데모입니다. 회원가입 후 프로젝트를 만들고, 작업을 추가하고, 상태별로 필터링하며 페이지를 이동할 수 있습니다. 실제 HTTP API와 관계형 데이터베이스를 사용합니다.

DevOn의 코드베이스 분석, 채용 요구사항과 기술 경험 매칭, 수정 과제, 모의 면접 흐름을 확인하기 위한 독립 테스트 프로젝트입니다. 구체적인 활용 시나리오와 공개 저장소 검증 절차는 [DevOn 테스트 안내](docs/devon-testing.md)에 정리합니다.

## 제공 기능

- 이메일 회원가입, Argon2 비밀번호 해시, HS256 JWT 로그인, 내 계정 확인
- 소유자별 프로젝트 생성·목록·상세·수정·삭제
- 프로젝트 안의 작업 생성·목록·상세·수정·삭제
- 작업 상태 `TODO` → `IN_PROGRESS` → `DONE` (어느 상태로든 변경 가능)
- 상태 필터, 프로젝트/작업 페이지 처리, 개수 응답
- 중첩 경로의 프로젝트/작업 소속과 사용자 소유권 검사
- 빈 제목·길이·이메일·상태·페이지·알 수 없는 필드 검증
- React 화면의 로그인/회원가입, CRUD, 삭제 확인, 로딩·빈 목록·입력/API 오류·만료 처리

프로젝트를 삭제하면 포함된 작업도 DB 외래키의 `ON DELETE CASCADE`로 함께 삭제됩니다. 다른 사용자의 리소스와 존재하지 않는 리소스는 모두 `404`로 응답합니다.

## 기술과 설계 이유

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| API | Python 3.13+, FastAPI | 타입 기반 입력/응답 검증과 OpenAPI |
| DB | SQLModel, PostgreSQL 17, Alembic | 관계·제약조건·마이그레이션을 명시적으로 관리 |
| 인증 | PyJWT, argon2-cffi | 만료를 검사하는 토큰과 단방향 비밀번호 해시 |
| 화면 | React 19, TypeScript 7, Vite 8 | 타입 검사와 작은 컴포넌트 중심 UI |
| 검증 | pytest, TestClient, Vitest, Testing Library | 실제 DB/API 통합 계약과 사용자 화면 흐름 검증 |
| 실행 | uv.lock, package-lock.json, Docker Compose | 의존성 설치와 전체 서비스 구성을 재현 |

정확한 설치 버전은 잠금 파일이 기준입니다. 검증한 주요 버전은 FastAPI 0.162.2, SQLModel 0.0.48, PostgreSQL 17.6, React 19.3.1, Vite 8.3.7, Node 22.14.0입니다.

```text
backend/
  app/routers/       HTTP 경로와 응답 계약
  app/services.py    인증·소유권·중첩 리소스 규칙
  app/repository.py  SQL 조회와 저장
  app/models.py      테이블·외래키·DB 제약조건
  app/schemas.py     요청/응답 DTO
  app/seed.py        반복 가능한 샘플 데이터
  alembic/          초기 스키마 마이그레이션
  tests/            API 통합 테스트
  scripts/smoke.py   실행 중 서버에 대한 HTTP 스모크 검사
frontend/src/
  App.tsx           세션 복원과 만료 처리
  AuthPanel.tsx     회원가입·로그인
  Workspace.tsx     프로젝트 목록·편집
  TaskPanel.tsx     작업 편집·상태·필터·페이지
  ItemEditor.tsx    입력 폼과 입력 오류
  api.ts            토큰 전송과 오류 해석
compose.yaml        DB → 마이그레이션/API → 화면 실행
docs/verification.md 실제 검증 결과와 미실행 범위
```

요청 흐름은 `React → router → service → repository → PostgreSQL`입니다. 인증 의존성이 토큰과 실제 사용자 존재를 확인하고, 서비스가 소유자와 부모 프로젝트를 확인합니다. 작업의 `project_id`나 프로젝트의 `owner_id`를 요청 본문에서 변경할 수 없습니다.

## 전체 실행: Docker Compose

필수 도구: Docker Engine/Desktop와 Compose v2. 이 개발 환경에는 Docker가 없어 아래 컨테이너 빌드/기동 명령은 실행하지 못했습니다. 같은 코드의 로컬 PostgreSQL 실행과 테스트는 확인했습니다.

프로젝트 루트에서 실행합니다.

```sh
cp .env.example .env
# .env의 JWT_SECRET을 아래 명령의 출력으로 교체합니다.
python -c "import secrets; print(secrets.token_urlsafe(48))"
docker compose up --build -d
docker compose exec backend .venv/bin/python -m app.seed
```

PowerShell에서는 첫 줄을 `Copy-Item .env.example .env`로 실행합니다. DB가 건강 상태가 되면 API가 `alembic upgrade head`를 실행하고 기동합니다. API의 `/health`가 성공한 뒤 화면이 기동합니다. 시드는 자동으로 넣지 않으며 필요할 때 별도 실행합니다.

| 대상 | 주소 |
| --- | --- |
| 화면 | http://localhost:5173 |
| API | http://localhost:8001 |
| Swagger UI | http://localhost:8001/docs |
| 준비 상태 | http://localhost:8001/health |
| PostgreSQL 호스트 포트 | localhost:55432 |

종료는 `docker compose down`입니다. DB는 `taskflow-db` 볼륨에 보존됩니다. 초기화가 필요할 때만 `docker compose down -v`를 사용합니다. 이 명령은 이 Compose 프로젝트의 DB 데이터를 삭제합니다.

## 로컬 실행

필수 도구: Python 3.13, [uv](https://docs.astral.sh/uv/), Node.js 22.12 이상, PostgreSQL 17. PostgreSQL에 앱용 사용자/데이터베이스를 먼저 만듭니다. 아래 SQL은 관리 계정의 `psql`에서 한 번 실행합니다.

```sql
CREATE USER taskflow WITH PASSWORD 'local-taskflow-password';
CREATE DATABASE taskflow OWNER taskflow;
```

기본 `.env.example`은 PostgreSQL의 호스트 포트가 `55432`라고 가정합니다. 로컬 설치의 기본 포트가 `5432`이면 URL의 포트를 바꿉니다.

API 터미널:

```sh
cd backend
cp .env.example .env
# .env의 DATABASE_URL과 임의 JWT_SECRET을 설정합니다.
uv sync --frozen
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001
```

화면 터미널:

```sh
cd frontend
cp .env.example .env
npm ci
npm run dev
```

PowerShell에서 복사는 `Copy-Item`을 사용합니다. 샌드박스 캐시 권한 문제가 있는 환경은 설치 전에 `$env:UV_CACHE_DIR = Join-Path (Get-Location) '.uv-cache'`를 설정할 수 있습니다. 일반 환경에는 필요하지 않습니다.

| 환경변수 | 위치 | 의미 |
| --- | --- | --- |
| `DATABASE_URL` | backend/.env | `postgresql+psycopg://사용자:암호@호스트:포트/DB` |
| `JWT_SECRET` | 루트/백엔드 .env | 최소 32자, 각 환경에서 직접 생성 |
| `TOKEN_MINUTES` | 루트/백엔드 .env | 토큰 수명, 기본 60, 범위 1~1440분 |
| `CORS_ORIGINS` | 루트/백엔드 .env | 쉼표로 구분한 허용 화면 origin |
| `VITE_API_URL` | frontend/.env 또는 Compose 빌드 인수 | 브라우저에서 접근할 API 주소, 기본 `http://localhost:8001` |
| `POSTGRES_*` | 루트 .env | Compose DB 생성용 값 |

`.env`와 캐시, 가상환경, 빌드 산출물은 Git 제외 대상입니다. Compose DB 암호에 URL 예약 문자를 사용하면 `DATABASE_URL`에 들어가는 암호 부분은 URL 인코딩해야 합니다. `VITE_API_URL`은 빌드 시 값이므로 변경 후 화면을 다시 빌드합니다. 브라우저가 접근할 주소에 Compose 내부 호스트명 `backend`를 넣지 않습니다.

## 시드와 화면 확인

| 계정 | 비밀번호 | 샘플 |
| --- | --- | --- |
| `alice@example.com` | `DemoPass123!` | 출시 준비 7개 작업, 학습 기록 1개 작업 |
| `bob@example.com` | `DemoPass123!` | 디자인 시스템 1개 작업 |

초기 개수는 사용자 2명, 프로젝트 3개, 작업 9개입니다. `uv run python -m app.seed`를 반복해도 이메일, 소유자/프로젝트 제목, 프로젝트/작업 제목으로 기존 기록을 찾아 중복을 만들지 않습니다. 기존 비밀번호와 편집된 작업은 덮어쓰지 않습니다. 샘플 제목을 바꾸면 다음 시드가 원래 제목의 항목을 다시 만들 수 있습니다. 시드는 동시 실행용 도구가 아닙니다.

1. Alice로 로그인하고 출시 준비 프로젝트의 두 번째 작업 페이지를 확인합니다.
2. 작업 상태를 변경한 뒤 상태 필터에서 목록을 확인합니다.
3. 프로젝트와 작업을 새로 만들고 제목/설명을 수정합니다.
4. 작업 또는 프로젝트 삭제 버튼을 누르고 확인 화면에서 삭제합니다.
5. 로그아웃 후 Bob으로 로그인하면 Bob의 프로젝트만 보입니다.
6. 회원가입으로 별도 계정을 만들면 빈 워크스페이스에서 시작합니다.

## API 예시

로그인 JSON을 보내고 받은 `access_token`을 사용합니다. Bash 예시의 `TOKEN`, `PROJECT_ID`, `TASK_ID`는 실제 응답 값으로 바꿉니다.

```sh
curl -s http://localhost:8001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"DemoPass123!"}'

curl -s http://localhost:8001/api/projects \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"다음 스프린트","description":"목표를 작은 작업으로 나눕니다."}'

curl -s "http://localhost:8001/api/projects/$PROJECT_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"계약 검토","status":"TODO"}'

curl -s -X PATCH "http://localhost:8001/api/projects/$PROJECT_ID/tasks/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"DONE"}'

curl -s "http://localhost:8001/api/projects/$PROJECT_ID/tasks?status=DONE&page=1&page_size=5" \
  -H "Authorization: Bearer $TOKEN"
```

PowerShell 예시:

```powershell
$body = @{ email = 'alice@example.com'; password = 'DemoPass123!' } | ConvertTo-Json
$login = Invoke-RestMethod http://localhost:8001/api/auth/login -Method Post -ContentType 'application/json' -Body $body
$headers = @{ Authorization = "Bearer $($login.access_token)" }
$project = Invoke-RestMethod http://localhost:8001/api/projects -Method Post -Headers $headers -ContentType 'application/json' -Body '{"title":"Sprint"}'
Invoke-RestMethod "http://localhost:8001/api/projects/$($project.id)/tasks?page=1&page_size=5" -Headers $headers
```

목록 응답은 `{ "items": [], "total": 0, "page": 1, "page_size": 5 }` 형태입니다. `page`는 1~1,000,000, `page_size`는 1~100입니다. 기본 프로젝트 크기는 10, 작업 크기는 5이며 UI는 둘 다 5개를 사용합니다. ID 오름차순으로 정렬하며 범위를 넘긴 페이지는 빈 배열을 반환합니다. 작업의 `status`를 생략하면 전체 상태를 반환합니다.

| 상황 | 응답 |
| --- | --- |
| 생성 | `201` + 리소스 |
| 조회·수정·로그인 | `200` |
| 삭제 | `204` (본문 없음) |
| 인증 누락·잘못된/만료 토큰 | `401` + `WWW-Authenticate: Bearer` |
| 미존재·다른 사용자/다른 프로젝트의 자원 | `404` |
| 중복 이메일 | `409` |
| 입력·상태·페이지 검증 오류 | `422` |

제목은 공백 제거 후 1~120자, 설명은 최대 2000자, 비밀번호는 10~128자입니다. 부분 수정에는 적어도 하나의 필드가 필요하며 `null`을 받지 않습니다. 설명을 지우려면 빈 문자열을 전송합니다. 상세 계약은 `/docs`와 `/openapi.json`에서 확인할 수 있습니다.

## 테스트와 검증

기본 API 테스트는 각 케이스의 임시 SQLite DB에서 실행합니다. 인증·소유권·중첩 ID·CRUD·상태 필터·페이지·입력 검증을 실제 HTTP 핸들러와 SQL 쿼리로 검사합니다.

```sh
cd backend
uv run pytest -q
uv run ruff check app tests alembic scripts
uv run ruff format --check app tests alembic scripts
uv run python -m compileall -q app
```

PostgreSQL 테스트는 **전용 빈 테스트 DB**를 사용합니다. 테스트는 해당 DB의 `users/projects/tasks` 테이블을 삭제하고 다시 만듭니다. 실행 중 앱 DB나 보존할 데이터베이스를 지정하지 마세요.

```sh
# Bash
TEST_DATABASE_URL='postgresql+psycopg://taskflow:local-taskflow-password@localhost:55432/taskflow_tests' uv run pytest -q
```

```powershell
# PowerShell
$env:TEST_DATABASE_URL = 'postgresql+psycopg://taskflow:local-taskflow-password@localhost:55432/taskflow_tests'
uv run pytest -q --basetemp=.pytest-tmp
Remove-Item Env:TEST_DATABASE_URL
```

테스트 DB도 별도로 생성하고 권한을 부여해야 합니다. API 테스트는 ORM 메타데이터로 테이블을 만들며, 실제 마이그레이션은 별도의 빈 DB에서 `alembic upgrade head`, 반복 시드, `alembic check`와 실제 HTTP 스모크로 확인했습니다.

```sh
# API와 DB가 실행되고 시드가 준비된 상태에서 backend/에서 실행
uv run python scripts/smoke.py
uv run alembic check

cd ../frontend
npm test
npm run build
npm run format:check
```

코드 실행 결과는 [docs/verification.md](docs/verification.md)에 기록했습니다. [etherroman/devon-demo-taskflow](https://github.com/etherroman/devon-demo-taskflow)에 독립 Public 저장소로 게시했으며, GitHub API 수집 조건의 확인 결과는 [게시 검증](docs/publication.md)에 기록합니다. 애플리케이션의 공개 서버 배포는 수행하지 않았습니다.

## 범위와 알려진 한계

- 단일 사용자 소유권 모델이며 프로젝트 공유·역할·담당자·기한·파일 업로드는 제공하지 않습니다.
- 인증은 데모용 단기 액세스 토큰입니다. refresh token, 서버 로그아웃/즉시 폐기, 이메일 인증, 비밀번호 재설정, 로그인 속도 제한은 구현하지 않았습니다. 화면 로그아웃은 현재 탭의 `sessionStorage` 토큰을 삭제합니다.
- 동시 편집 충돌 감지와 오프셋 페이지 간 스냅샷 일관성은 제공하지 않습니다. 리소스 하나의 저장/삭제는 DB 트랜잭션으로 처리합니다.
- 로컬/Compose 개발 구성이며 공개 운영을 위한 HTTPS 프록시·비밀 관리·백업·관측성 설정은 별도입니다. 샘플 계정은 공개된 데모 데이터입니다.
- Docker 실행은 현재 환경에 Docker가 없어 미검증입니다. 로컬 PostgreSQL 통합 테스트, 마이그레이션, 시드, HTTP 요청, 화면 빌드는 실제 실행했습니다.

## 참고

[FastAPI Full Stack Template](https://github.com/fastapi/full-stack-fastapi-template)의 기술 조합과 환경 분리 방식을 참고했습니다. 도메인·라우터·서비스·저장소·화면·테스트는 새로 작성했으며 템플릿 소스를 복사하지 않았습니다. [참고/의존성 고지](THIRD_PARTY_NOTICES.md), [MIT 라이선스](LICENSE)를 확인할 수 있습니다.

공식 문서: [FastAPI](https://fastapi.tiangolo.com/), [SQLModel](https://sqlmodel.tiangolo.com/), [Alembic](https://alembic.sqlalchemy.org/), [React](https://react.dev/), [Vite](https://vite.dev/), [uv](https://docs.astral.sh/uv/).
