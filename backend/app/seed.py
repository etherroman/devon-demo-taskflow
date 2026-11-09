"""Run after migrations. Repeating preserves existing users and demo records."""

from sqlmodel import Session, select

from app.config import Settings
from app.database import make_engine
from app.models import Project, Task, User
from app.services import password_hasher

DEMO_PASSWORD = "DemoPass123!"
SAMPLES = {
    "alice@example.com": {
        "서비스 출시 준비": [
            ("요구사항 정리", "핵심 사용자 시나리오를 검토합니다.", "DONE"),
            ("API 계약 검토", "페이지 처리와 오류 응답을 확인합니다.", "DONE"),
            ("화면 구현", "프로젝트와 작업 관리 화면을 연결합니다.", "IN_PROGRESS"),
            ("접근성 확인", "키보드 탐색과 레이블을 점검합니다.", "TODO"),
            ("통합 테스트", "인증 및 사용자별 격리를 검증합니다.", "IN_PROGRESS"),
            ("배포 문서 작성", "새 환경의 설치 절차를 기록합니다.", "TODO"),
            ("출시 회고 준비", "회고에서 다룰 질문을 수집합니다.", "TODO"),
        ],
        "개인 학습 기록": [("SQLModel 살펴보기", "모델과 트랜잭션 경계를 학습합니다.", "TODO")],
    },
    "bob@example.com": {
        "디자인 시스템": [("색상 토큰 정리", "공통 색상과 대비를 점검합니다.", "IN_PROGRESS")],
    },
}


def seed():
    engine = make_engine(Settings().database_url)
    with Session(engine) as session:
        for email, projects in SAMPLES.items():
            user = session.exec(select(User).where(User.email == email)).first()
            if user is None:
                user = User(email=email, password_hash=password_hasher.hash(DEMO_PASSWORD))
                session.add(user)
                session.flush()
            for title, tasks in projects.items():
                project = session.exec(
                    select(Project).where(Project.owner_id == user.id, Project.title == title)
                ).first()
                if project is None:
                    project = Project(
                        owner_id=user.id,
                        title=title,
                        description="반복 실행해도 중복되지 않는 데모 프로젝트입니다.",
                    )
                    session.add(project)
                    session.flush()
                for task_title, description, status in tasks:
                    existing = session.exec(
                        select(Task).where(Task.project_id == project.id, Task.title == task_title)
                    ).first()
                    if existing is None:
                        session.add(
                            Task(
                                project_id=project.id,
                                title=task_title,
                                description=description,
                                status=status,
                            )
                        )
        session.commit()
        print("Seed ready: alice@example.com / bob@example.com (existing records preserved)")
    engine.dispose()


if __name__ == "__main__":
    seed()
