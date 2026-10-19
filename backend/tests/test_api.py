import os
import sys
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo.errors import PyMongoError

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["JWT_SECRET_KEY"] = "fittrack-test-secret-at-least-32-bytes"

import main


class FakeUsersCollection:
    def __init__(self):
        self.documents = {}
        self.fail_on_index = False
        self.fail_on_find = False

    def create_index(self, *_args, **_kwargs):
        if self.fail_on_index:
            raise PyMongoError("MongoDB is unavailable")

    def find_one(self, query):
        if self.fail_on_find:
            raise PyMongoError("MongoDB is unavailable")
        return next(
            (
                document
                for document in self.documents.values()
                if all(document.get(key) == value for key, value in query.items())
            ),
            None,
        )

    def insert_one(self, document):
        user_id = ObjectId()
        self.documents[user_id] = {**document, "_id": user_id}
        return SimpleNamespace(inserted_id=user_id)

    def update_one(self, query, update):
        document = self.find_one(query)
        if document:
            document.update(update["$set"])


class FakeCursor(list):
    def sort(self, key, direction):
        super().sort(key=lambda item: item[key], reverse=direction < 0)
        return self

    def limit(self, count):
        return FakeCursor(self[:count])


class FakeWorkoutsCollection:
    def __init__(self):
        self.documents = {}

    def create_index(self, *_args, **_kwargs):
        return None

    def insert_one(self, document):
        workout_id = ObjectId()
        self.documents[workout_id] = {**document, "_id": workout_id}
        return SimpleNamespace(inserted_id=workout_id)

    def find_one(self, query):
        return self.documents.get(query["_id"])

    def find(self, query):
        return FakeCursor(
            document
            for document in self.documents.values()
            if document["userId"] == query["userId"]
        )

    def delete_one(self, query):
        document = self.documents.get(query["_id"])
        if document and document["userId"] == query["userId"]:
            del self.documents[query["_id"]]
            return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.users = FakeUsersCollection()
        self.workouts = FakeWorkoutsCollection()
        self.users_patch = patch.object(main, "users_collection", self.users)
        self.workouts_patch = patch.object(
            main, "workouts_collection", self.workouts
        )
        self.users_patch.start()
        self.workouts_patch.start()
        self.client = TestClient(main.app)

    def tearDown(self):
        self.client.close()
        self.workouts_patch.stop()
        self.users_patch.stop()

    def create_user_headers(self):
        user_id = ObjectId()
        self.users.documents[user_id] = {
            "_id": user_id,
            "name": "Test User",
            "email": "test@example.com",
            "hashed_password": main.password_hash.hash("test-password"),
        }
        token = main.create_access_token(str(user_id))
        return {"Authorization": f"Bearer {token}"}

    def test_signup_and_current_user(self):
        response = self.client.post(
            "/auth/signup",
            json={
                "name": "Test User",
                "email": " TEST@example.com ",
                "password": "test-password",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user"]["email"], "test@example.com")
        self.assertNotIn("hashed_password", response.json()["user"])
        account = self.client.get(
            "/auth/me",
            headers={
                "Authorization": f"Bearer {response.json()['access_token']}"
            },
        )
        self.assertEqual(account.status_code, 200)
        self.assertEqual(account.json()["user"]["name"], "Test User")

    def test_signup_returns_service_unavailable_when_database_is_down(self):
        self.users.fail_on_index = True

        response = self.client.post(
            "/auth/signup",
            json={
                "name": "Test User",
                "email": "test@example.com",
                "password": "test-password",
            },
        )

        self.assertEqual(response.status_code, 503)

    def test_login_succeeds_with_signup_credentials_and_normalized_email(self):
        signup = self.client.post(
            "/auth/signup",
            json={
                "name": "Test User",
                "email": "Test.Login@Example.com",
                "password": "test-password",
            },
        )
        self.assertEqual(signup.status_code, 201)

        login = self.client.post(
            "/auth/login",
            json={
                "email": " TEST.LOGIN@example.com ",
                "password": "test-password",
            },
        )

        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["user"]["email"], "test.login@example.com")
        self.assertEqual(login.json()["token_type"], "bearer")
        self.assertTrue(login.json()["access_token"])

    def test_login_rejects_an_incorrect_password(self):
        signup = self.client.post(
            "/auth/signup",
            json={
                "name": "Test User",
                "email": "test.login@example.com",
                "password": "test-password",
            },
        )
        self.assertEqual(signup.status_code, 201)

        login = self.client.post(
            "/auth/login",
            json={
                "email": "test.login@example.com",
                "password": "incorrect-password",
            },
        )

        self.assertEqual(login.status_code, 401)
        self.assertEqual(login.json()["detail"], "Incorrect email or password.")

    def test_health_returns_service_unavailable_when_database_is_down(self):
        def fail_ping(_command):
            raise PyMongoError(
                "connection failed for "
                "mongodb+srv://db-user:secret-password@cluster.mongodb.net"
            )

        offline_client = SimpleNamespace(
            admin=SimpleNamespace(command=fail_ping)
        )

        with (
            patch.object(main, "client", offline_client),
            self.assertLogs(main.logger, level="ERROR") as logs,
        ):
            response = self.client.get("/health")

        self.assertEqual(response.status_code, 503)
        self.assertIn("PyMongoError", logs.output[0])
        self.assertIn("<redacted MongoDB URI>", logs.output[0])
        self.assertNotIn("secret-password", logs.output[0])

    def test_login_returns_service_unavailable_when_database_is_down(self):
        self.users.fail_on_find = True

        response = self.client.post(
            "/auth/login",
            json={"email": "test@example.com", "password": "test-password"},
        )

        self.assertEqual(response.status_code, 503)

    def test_authenticated_request_returns_service_unavailable_when_database_is_down(
        self,
    ):
        headers = self.create_user_headers()
        self.users.fail_on_find = True

        response = self.client.get("/auth/me", headers=headers)

        self.assertEqual(response.status_code, 503)

    def test_invalid_route_coordinates_are_rejected(self):
        response = self.client.post(
            "/workouts",
            headers=self.create_user_headers(),
            json={
                "activity": "Running",
                "durationMs": 1000,
                "distanceMeters": 10,
                "routePoints": [[91, 0]],
                "completedAt": datetime.now(timezone.utc).isoformat(),
            },
        )

        self.assertEqual(response.status_code, 422)

    def test_workout_can_be_created_listed_and_deleted(self):
        headers = self.create_user_headers()
        workout = {
            "activity": "Running",
            "durationMs": 60000,
            "distanceMeters": 250,
            "routePoints": [[40.7, -74.0], [40.71, -74.01]],
            "completedAt": datetime.now(timezone.utc).isoformat(),
        }

        created = self.client.post("/workouts", headers=headers, json=workout)
        self.assertEqual(created.status_code, 201)
        workout_id = created.json()["workout"]["id"]

        listed = self.client.get("/workouts", headers=headers)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()["count"], 1)
        self.assertEqual(listed.json()["workouts"][0]["id"], workout_id)

        deleted = self.client.delete(
            f"/workouts/{workout_id}", headers=headers
        )
        self.assertEqual(deleted.status_code, 200)
        self.assertEqual(
            self.client.get("/workouts", headers=headers).json()["count"],
            0,
        )


if __name__ == "__main__":
    unittest.main()
