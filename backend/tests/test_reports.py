import json
import pytest

from app import db, _build_report_summary  # noqa: E402
from tests.conftest import auth_headers_for  # noqa: E402


class TestBuildReportSummary:
    """Unit tests for _build_report_summary function."""

    def test_student_performance_report(self, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel
            student = db.session.get(UserModel, "stu-1")
            summary, status = _build_report_summary(
                "Student Performance", target_id="stu-1", teacher_id="tea-1"
            )
            assert status == 200
            assert summary["studentId"] == "stu-1"
            assert summary["studentName"] == "Alice Smith"
            assert summary["quizzesTaken"] == 2
            assert summary["averageScore"] == 70  # (80 + 60) / 2
            assert summary["passRate"] == 50  # 1 passed out of 2
            assert "Algorithms" in summary["strongTopics"]
            assert "Databases" in summary["weakTopics"]
            assert len(summary["recentAttempts"]) == 2

    def test_student_performance_report_invalid_student(self, init_database, app_instance):
        with app_instance.app_context():
            summary, status = _build_report_summary(
                "Student Performance", target_id="nonexistent", teacher_id="tea-1"
            )
            assert status == 400
            assert "error" in summary

    def test_student_performance_report_not_enrolled(self, init_database, app_instance):
        with app_instance.app_context():
            # Teacher tea-1 teaches sub-1 and sub-2, student stu-1 is enrolled in both.
            # Create a different student not enrolled.
            from app import UserModel
            stu2 = UserModel(
                user_id="stu-2", role_id=1, role="student",
                first_name="Eve", last_name="Student",
                email="eve@test.com", password_hash="hash",
                status="active", token_version=0, created_at="2026-01-01T00:00:00Z"
            )
            db.session.add(stu2)
            db.session.commit()
            summary, status = _build_report_summary(
                "Student Performance", target_id="stu-2", teacher_id="tea-1"
            )
            assert status == 403

    def test_quiz_analytics_report(self, init_database, app_instance):
        with app_instance.app_context():
            summary, status = _build_report_summary("Quiz Analytics", teacher_id="tea-1")
            assert status == 200
            assert summary["totalAttempts"] == 2
            assert summary["overallAverage"] == 70
            assert len(summary["quizzes"]) == 2
            for q in summary["quizzes"]:
                assert q["attempts"] == 1
                assert "quizTitle" in q
                assert "averageScore" in q

    def test_quiz_analytics_report_filtered_by_quiz(self, init_database, app_instance):
        with app_instance.app_context():
            summary, status = _build_report_summary(
                "Quiz Analytics", target_id="qz-1", teacher_id="tea-1"
            )
            assert status == 200
            assert summary["totalAttempts"] == 1
            assert len(summary["quizzes"]) == 1
            assert summary["quizzes"][0]["quizId"] == "qz-1"

    def test_subject_summary_report(self, init_database, app_instance):
        with app_instance.app_context():
            summary, status = _build_report_summary("Subject Summary", teacher_id="tea-1")
            assert status == 200
            assert len(summary["subjects"]) == 2
            for s in summary["subjects"]:
                assert "subjectId" in s
                assert "subjectName" in s
                assert "teacherName" in s
                assert "averageScore" in s
                assert "passRate" in s

    def test_ai_usage_report(self, init_database, app_instance):
        with app_instance.app_context():
            summary, status = _build_report_summary("AI Usage", teacher_id="tea-1")
            assert status == 200
            assert "totalGenerated" in summary
            assert "quizCount" in summary
            assert "generationEvents" in summary
            assert "breakdown" in summary


class TestReportsEndpoints:
    """Integration tests for report API endpoints."""

    def test_generate_student_performance_report(self, client, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel
            teacher = db.session.get(UserModel, "tea-1")
            headers = auth_headers_for(teacher)

            resp = client.post("/api/reports",
                data=json.dumps({
                    "reportType": "Student Performance",
                    "title": "Alice's Progress Report",
                    "targetId": "stu-1",
                    "teacherId": "tea-1",
                    "userRole": "teacher",
                }),
                content_type="application/json",
                headers=headers,
            )
            assert resp.status_code == 201
            data = resp.get_json()
            assert data["reportType"] == "Student Performance"
            assert data["title"] == "Alice's Progress Report"
            assert data["generatedBy"] == "tea-1"
            assert data["targetId"] == "stu-1"

    def test_generate_report_invalid_type(self, client, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel
            teacher = db.session.get(UserModel, "tea-1")
            headers = auth_headers_for(teacher)

            resp = client.post("/api/reports",
                data=json.dumps({
                    "reportType": "Invalid Type",
                    "title": "Test",
                }),
                content_type="application/json",
                headers=headers,
            )
            assert resp.status_code == 400

    def test_list_reports(self, client, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel, ReportModel
            teacher = db.session.get(UserModel, "tea-1")
            headers = auth_headers_for(teacher)

            # Generate a report first
            client.post("/api/reports",
                data=json.dumps({
                    "reportType": "Student Performance",
                    "title": "Test Report",
                    "targetId": "stu-1",
                    "teacherId": "tea-1",
                    "userRole": "teacher",
                }),
                content_type="application/json",
                headers=headers,
            )

            # List reports
            resp = client.get("/api/reports", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert "reports" in data
            assert "total" in data
            assert "hasMore" in data
            assert data["total"] >= 1
            assert len(data["reports"]) >= 1

    def test_list_reports_pagination(self, client, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel, ReportModel
            teacher = db.session.get(UserModel, "tea-1")
            headers = auth_headers_for(teacher)

            # Generate 3 reports
            for i in range(3):
                client.post("/api/reports",
                    data=json.dumps({
                        "reportType": "Student Performance",
                        "title": f"Report {i}",
                        "targetId": "stu-1",
                        "teacherId": "tea-1",
                        "userRole": "teacher",
                    }),
                    content_type="application/json",
                    headers=headers,
                )

            # Get first page with limit=2
            resp = client.get("/api/reports?limit=2&offset=0", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["total"] == 3
            assert len(data["reports"]) == 2
            assert data["hasMore"] is True

            # Get second page
            resp = client.get("/api/reports?limit=2&offset=2", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert len(data["reports"]) == 1
            assert data["hasMore"] is False

    def test_list_reports_target_id_filter(self, client, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel, ReportModel
            teacher = db.session.get(UserModel, "tea-1")
            headers = auth_headers_for(teacher)

            # Generate reports for different targets
            client.post("/api/reports",
                data=json.dumps({
                    "reportType": "Student Performance",
                    "title": "Report for stu-1",
                    "targetId": "stu-1",
                    "teacherId": "tea-1",
                    "userRole": "teacher",
                }),
                content_type="application/json",
                headers=headers,
            )
            client.post("/api/reports",
                data=json.dumps({
                    "reportType": "Quiz Analytics",
                    "title": "Quiz Report",
                    "targetId": "qz-1",
                    "teacherId": "tea-1",
                    "userRole": "teacher",
                }),
                content_type="application/json",
                headers=headers,
            )

            # Filter by targetId
            resp = client.get("/api/reports?targetId=stu-1", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert data["total"] == 1
            assert data["reports"][0]["targetId"] == "stu-1"

    def test_delete_report(self, client, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel, ReportModel
            teacher = db.session.get(UserModel, "tea-1")
            headers = auth_headers_for(teacher)

            resp = client.post("/api/reports",
                data=json.dumps({
                    "reportType": "Student Performance",
                    "title": "To Delete",
                    "targetId": "stu-1",
                    "teacherId": "tea-1",
                    "userRole": "teacher",
                }),
                content_type="application/json",
                headers=headers,
            )
            report_id = resp.get_json()["id"]

            resp = client.delete(f"/api/reports/{report_id}", headers=headers)
            assert resp.status_code == 200

            # Verify it's gone
            resp = client.get(f"/api/reports/{report_id}", headers=headers)
            assert resp.status_code == 404

    def test_admin_analytics_endpoint(self, client, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel
            admin = db.session.get(UserModel, "adm-1")
            headers = auth_headers_for(admin)

            resp = client.get("/api/analytics/admin", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert "subjects" in data
            assert "totals" in data
            assert data["totals"]["subjectCount"] == 2
            assert data["totals"]["studentCount"] == 1
            assert data["totals"]["attempts"] == 2

    def test_admin_analytics_forbidden_for_teacher(self, client, init_database, app_instance):
        with app_instance.app_context():
            from app import UserModel
            teacher = db.session.get(UserModel, "tea-1")
            headers = auth_headers_for(teacher)

            resp = client.get("/api/analytics/admin", headers=headers)
            assert resp.status_code == 403

    def test_generated_at_is_server_set(self, client, init_database, app_instance):
        """generatedAt should be set by server, not client-supplied."""
        with app_instance.app_context():
            from app import UserModel
            teacher = db.session.get(UserModel, "tea-1")
            headers = auth_headers_for(teacher)

            # Try to backdate generatedAt
            far_future = "2099-12-31T23:59:59Z"
            resp = client.post("/api/reports",
                data=json.dumps({
                    "reportType": "Student Performance",
                    "title": "Backdated",
                    "targetId": "stu-1",
                    "teacherId": "tea-1",
                    "userRole": "teacher",
                    "generatedAt": far_future,
                }),
                content_type="application/json",
                headers=headers,
            )
            assert resp.status_code == 201
            data = resp.get_json()
            # The generated_at should NOT be the far future date
            assert data["generatedAt"] != far_future
