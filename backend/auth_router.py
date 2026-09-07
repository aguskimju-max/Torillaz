from fastapi import APIRouter, Request, Response, HTTPException, Depends, Body
from pydantic import BaseModel

from db import db, oid, now_iso, log_audit
from security import (hash_password, verify_password, create_access_token,
                      create_refresh_token, set_auth_cookies, clear_auth_cookies,
                      get_current_user, optional_current_user, check_lockout,
                      register_failed, clear_attempts)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginInput(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(request: Request, response: Response, body: LoginInput):
    email = body.email.lower().strip()
    # Key lockout by email only: request.client.host is the proxy/pod IP behind
    # k8s ingress and fragments counts across replicas.
    identifier = f"email:{email}"
    await check_lockout(identifier)

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        await register_failed(identifier)
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Akun nonaktif, hubungi administrator")

    await clear_attempts(identifier)
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)

    role_doc = await db.roles.find_one({"name": user.get("role")})
    await log_audit({"id": uid, "name": user.get("name"), "email": email},
                    "login", "pengaturan", "user", uid, f"Login: {email}")
    return {
        "id": uid, "email": email, "name": user.get("name"),
        "role": user.get("role"),
        "role_label": (role_doc or {}).get("label", user.get("role")),
        "permissions": (role_doc or {}).get("permissions", {}),
        "access_token": access,
    }


@router.post("/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user


@router.get("/session")
async def session(user=Depends(optional_current_user)):
    """Non-erroring session probe used by the frontend on load (avoids 401 console noise)."""
    if not user:
        return {"authenticated": False, "user": None}
    return {"authenticated": True, "user": user}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    import jwt as _jwt
    from security import _secret, JWT_ALGORITHM
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak ada refresh token")
    try:
        payload = _jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token tidak valid")
        user = await db.users.find_one({"_id": oid(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User tidak ditemukan")
        access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie(key="access_token", value=access, httponly=True,
                            secure=True, samesite="none", max_age=12 * 3600, path="/")
        return {"ok": True}
    except _jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
