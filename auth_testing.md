# Auth Testing Playbook (ERP)

Admin credentials are in /app/memory/test_credentials.md.

## API test
```
API=https://repo-ulang-build.preview.emergentagent.com
curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"aguskimju@gmail.com","password":"Admin@12345"}'
curl -b cookies.txt $API/api/auth/me
```
Login returns the user object with role + permissions, sets access_token/refresh_token cookies, and returns access_token in body.

## RBAC
- super_admin/owner => all modules all actions.
- Other roles have scoped permissions (see /api/roles).
- Protected routes use require(module, action); 403 when missing permission.
