from __future__ import annotations

import json

import firebase_admin
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth, credentials

from .config import Settings
from .models import AuthenticatedUser

bearer_scheme = HTTPBearer(auto_error=False)
FIREBASE_AUTH_HEADER = "x-firebase-authorization"


class FirebaseTokenVerifier:
    def __init__(self, settings: Settings):
        self._app = self._initialize_app(settings)

    def _initialize_app(self, settings: Settings):
        try:
            return firebase_admin.get_app()
        except ValueError:
            pass

        credential = self._build_credentials(settings)
        options = {"projectId": settings.firebase_project_id}
        return firebase_admin.initialize_app(credential=credential, options=options)

    def _build_credentials(self, settings: Settings):
        if settings.firebase_service_account_json:
            return credentials.Certificate(json.loads(settings.firebase_service_account_json))

        if settings.firebase_service_account_file:
            return credentials.Certificate(settings.firebase_service_account_file)

        return credentials.ApplicationDefault()

    def verify(self, id_token: str) -> AuthenticatedUser:
        try:
            decoded = auth.verify_id_token(id_token, app=self._app, check_revoked=False)
        except Exception as caught:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Firebase ID token",
            ) from caught

        return AuthenticatedUser(
            uid=str(decoded["uid"]),
            email=decoded.get("email"),
        )


def get_token_verifier(request: Request) -> FirebaseTokenVerifier:
    return request.app.state.token_verifier


def get_current_user(
    request: Request,
    credentials_: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    token_verifier: FirebaseTokenVerifier = Depends(get_token_verifier),
) -> AuthenticatedUser:
    header_value = request.headers.get(FIREBASE_AUTH_HEADER)
    token: str | None = None

    if header_value:
        scheme, _, value = header_value.partition(" ")
        if scheme.lower() == "bearer" and value:
            token = value.strip()

    if token is None and credentials_ is not None and credentials_.scheme.lower() == "bearer":
        token = credentials_.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    return token_verifier.verify(token)
