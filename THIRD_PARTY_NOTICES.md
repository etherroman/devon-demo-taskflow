# 참고 및 의존성

- 구조 참고: [fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template), MIT, [원본 라이선스](https://github.com/fastapi/full-stack-fastapi-template/blob/master/LICENSE).
- 참고 범위는 FastAPI + SQLModel + PostgreSQL + React의 기술 조합과 환경 분리 방식이다. 템플릿 소스, UI, 인증 코드, 마이그레이션, 테스트를 복사하지 않았으며 이 저장소의 도메인 코드는 새로 작성했다.
- 설치되는 라이브러리와 컨테이너 이미지는 각 배포물의 라이선스를 따른다. `backend/uv.lock`과 `frontend/package-lock.json`에 정확한 의존성 버전이 기록되어 있다.
- 실행 시 유료 API, 외부 인증 서비스, 외부 폰트 다운로드가 필요하지 않다.
