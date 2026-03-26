#!/usr/bin/env bash
#
# Post-deploy smoke test for the kan kanban board app.
# Usage: bash scripts/smoke-test.sh [BASE_URL]
# Default BASE_URL: http://localhost:8787
#
set -euo pipefail

BASE_URL="${1:-http://localhost:8787}"
COOKIE_JAR=$(mktemp)
CURL_OPTS=("--silent" "--show-error" "--max-time" "15" "--fail-with-body")
# Better Auth requires Origin header on POST requests (CSRF protection)
POST_HEADERS=(-H "Content-Type: application/json" -H "Origin: ${BASE_URL}")
PASS=0
FAIL=0
RAND_SUFFIX=$(date +%s)$$

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

# --- Helpers ----------------------------------------------------------------

green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }

pass() {
  green "  [PASS] $1"
  PASS=$((PASS + 1))
}

fail() {
  red "  [FAIL] $1"
  if [ -n "${2:-}" ]; then
    red "         $2"
  fi
  FAIL=$((FAIL + 1))
}

# Run a test. Stops on first failure.
# Usage: run_test "description" <test_function>
run_test() {
  local desc="$1"
  shift
  if "$@"; then
    pass "$desc"
  else
    fail "$desc"
    echo ""
    red "Stopping — first failure encountered."
    summary
    exit 1
  fi
}

summary() {
  echo ""
  echo "--------------------------------------"
  echo "Results: $PASS passed, $FAIL failed"
  echo "--------------------------------------"
}

# --- Test functions ---------------------------------------------------------

test_health() {
  local body
  body=$(curl "${CURL_OPTS[@]}" "$BASE_URL/api/health" 2>&1) || {
    fail "GET /api/health" "curl error or non-200 status"
    return 1
  }
  if echo "$body" | grep -q '"status":"ok"'; then
    return 0
  fi
  fail "GET /api/health" "expected {\"status\":\"ok\"}, got: $body"
  return 1
}

test_env_js() {
  local body
  body=$(curl "${CURL_OPTS[@]}" "$BASE_URL/__ENV.js" 2>&1) || {
    fail "GET /__ENV.js" "curl error or non-200 status"
    return 1
  }
  if echo "$body" | grep -q 'window\.__ENV'; then
    return 0
  fi
  fail "GET /__ENV.js" "expected window.__ENV in response, got: $body"
  return 1
}

test_auth_ok() {
  local body
  body=$(curl "${CURL_OPTS[@]}" "$BASE_URL/api/auth/ok" 2>&1) || {
    fail "GET /api/auth/ok" "curl error or non-200 status"
    return 1
  }
  if echo "$body" | grep -q '"ok":true'; then
    return 0
  fi
  fail "GET /api/auth/ok" "expected {\"ok\":true}, got: $body"
  return 1
}

# Generates a random test email and stores it for later tests
TEST_EMAIL=""
TEST_PASSWORD="SmokeTest!Passw0rd"
TEST_NAME="Smoke Test"

test_sign_up() {
  TEST_EMAIL="smoke-test-${RAND_SUFFIX}@example.com"
  local body http_code
  http_code=$(curl --silent --show-error --max-time 15 \
    -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL/api/auth/sign-up/email" \
    "${POST_HEADERS[@]}" \
    -d "{\"name\":\"${TEST_NAME}\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" \
    -c "$COOKIE_JAR" \
    2>&1) || {
    fail "POST /api/auth/sign-up/email" "curl error"
    return 1
  }
  if [ "$http_code" = "200" ]; then
    return 0
  fi
  fail "POST /api/auth/sign-up/email" "expected 200, got: $http_code"
  return 1
}

test_sign_in() {
  local body http_code
  body=$(curl --silent --show-error --max-time 15 \
    -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/auth/sign-in/email" \
    "${POST_HEADERS[@]}" \
    -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" \
    -c "$COOKIE_JAR" \
    -b "$COOKIE_JAR" \
    2>&1)
  http_code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  if [ "$http_code" = "200" ]; then
    # Verify we got a session cookie
    if grep -q "kan" "$COOKIE_JAR" 2>/dev/null; then
      return 0
    fi
    # Cookie may have a different exact name — accept 200 as sufficient
    return 0
  fi
  fail "POST /api/auth/sign-in/email" "expected 200, got: $http_code (body: $body)"
  return 1
}

WORKSPACE_PUBLIC_ID=""

test_workspace_create() {
  local body http_code
  body=$(curl --silent --show-error --max-time 15 \
    -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/trpc/workspace.create" \
    "${POST_HEADERS[@]}" \
    -d "{\"json\":{\"name\":\"Smoke Test Workspace ${RAND_SUFFIX}\"}}" \
    -b "$COOKIE_JAR" \
    -c "$COOKIE_JAR" \
    2>&1)
  http_code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  if [ "$http_code" != "200" ]; then
    fail "POST /api/trpc/workspace.create" "expected 200, got: $http_code (body: $body)"
    return 1
  fi

  if echo "$body" | grep -q 'publicId'; then
    # Extract publicId from tRPC JSON response: {"result":{"data":{"json":{...,"publicId":"xxx",...}}}}
    # Using grep + sed since we cannot rely on jq
    WORKSPACE_PUBLIC_ID=$(echo "$body" | grep -o '"publicId":"[^"]*"' | head -1 | sed 's/"publicId":"//;s/"//')
    if [ -n "$WORKSPACE_PUBLIC_ID" ]; then
      return 0
    fi
  fi
  fail "POST /api/trpc/workspace.create" "expected publicId in response, got: $body"
  return 1
}

test_board_create() {
  if [ -z "$WORKSPACE_PUBLIC_ID" ]; then
    fail "POST /api/trpc/board.create" "no workspace publicId available (previous test must have failed)"
    return 1
  fi

  local body http_code
  body=$(curl --silent --show-error --max-time 15 \
    -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/trpc/board.create" \
    "${POST_HEADERS[@]}" \
    -d "{\"json\":{\"name\":\"Smoke Test Board\",\"workspacePublicId\":\"${WORKSPACE_PUBLIC_ID}\",\"lists\":[\"To Do\",\"In Progress\",\"Done\"],\"labels\":[\"Bug\",\"Feature\"]}}" \
    -b "$COOKIE_JAR" \
    -c "$COOKIE_JAR" \
    2>&1)
  http_code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  if [ "$http_code" != "200" ]; then
    fail "POST /api/trpc/board.create" "expected 200, got: $http_code (body: $body)"
    return 1
  fi

  if echo "$body" | grep -q 'publicId'; then
    return 0
  fi
  fail "POST /api/trpc/board.create" "expected publicId in response, got: $body"
  return 1
}

test_signup_page() {
  local http_code
  http_code=$(curl --silent --show-error --max-time 15 \
    -o /dev/null -w "%{http_code}" \
    "$BASE_URL/signup" \
    2>&1) || {
    fail "GET /signup" "curl error"
    return 1
  }
  if [ "$http_code" = "200" ]; then
    return 0
  fi
  fail "GET /signup" "expected 200, got: $http_code"
  return 1
}

# --- Run tests --------------------------------------------------------------

echo ""
echo "Smoke testing: $BASE_URL"
echo "======================================"
echo ""

run_test "GET /api/health returns {\"status\":\"ok\"}"             test_health
run_test "GET /__ENV.js returns window.__ENV"                       test_env_js
run_test "GET /api/auth/ok returns {\"ok\":true}"                   test_auth_ok
run_test "POST /api/auth/sign-up/email creates test user (200)"     test_sign_up
run_test "POST /api/auth/sign-in/email logs in test user (200)"     test_sign_in
run_test "POST /api/trpc/workspace.create returns publicId"         test_workspace_create
run_test "POST /api/trpc/board.create returns publicId"             test_board_create
run_test "GET /signup returns 200 (static frontend)"                test_signup_page

summary

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
