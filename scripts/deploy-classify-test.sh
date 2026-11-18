#!/usr/bin/env bash
# Classifier coverage for scripts/deploy.sh. No Docker and no git mutations.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
# shellcheck disable=SC1091
source "$ROOT/scripts/deploy.sh"

failures=0

assert_mode() {
    local expect="$1"
    shift
    local got
    got=$(classify_mode "$@")
    if [ "$got" != "$expect" ]; then
        printf 'FAIL: [%s] → %s (expected %s)\n' "$*" "$got" "$expect" >&2
        failures=$((failures + 1))
    fi
}

assert_mode assets
assert_mode assets app/Http/Controllers/Foo.php resources/js/app.js resources/views/app.blade.php
assert_mode assets composer.json composer.lock database/migrations/2026_01_01_000000_example.php
assert_mode assets scripts/deploy.sh scripts/deploy-classify-test.sh .github/workflows/deploy.yml
assert_mode assets docker-compose.green.yml DEPLOY.md .gitignore
assert_mode assets public/index.php routes/web.php config/app.php

assert_mode nginx docker-config/nginx/default.conf
assert_mode nginx docker-config/nginx/upstream.default.conf
assert_mode nginx .deploy/nginx-upstream.conf
assert_mode nginx docker-config/nginx/default.conf app/Models/User.php composer.lock

assert_mode container Dockerfile
assert_mode container Dockerfile.php
assert_mode container services/foo/Dockerfile
assert_mode container .dockerignore
assert_mode container php.ini
assert_mode container php-fpm.conf
assert_mode container php-fpm.d/www.conf
assert_mode container docker-compose.yml
assert_mode container docker-compose.yaml
assert_mode container docker-compose.override.yml
assert_mode container docker-compose.prod.yml
assert_mode container compose.yml
assert_mode container compose.prod.yaml
assert_mode container docker/php/Dockerfile
assert_mode container docker/nginx/extra/site.conf
assert_mode container docker-config/php/custom.ini
assert_mode container docker-config/php/conf.d/opcache.ini
assert_mode container docker-config/scheduler/entrypoint.sh
assert_mode container docker-config/other/thing.txt
assert_mode container Dockerfile docker-config/nginx/default.conf app/Foo.php
assert_mode container docker-compose.green.yml Dockerfile

if ! grep -q 'include /var/www/.deploy/nginx-upstream.conf;' "$ROOT/docker-config/nginx/default.conf"; then
    echo 'FAIL: default.conf does not include the upstream file' >&2
    failures=$((failures + 1))
fi
# shellcheck disable=SC2016
if ! grep -q 'fastcgi_pass $php_upstream;' "$ROOT/docker-config/nginx/default.conf"; then
    # shellcheck disable=SC2016
    echo 'FAIL: default.conf does not proxy PHP through $php_upstream' >&2
    failures=$((failures + 1))
fi
# shellcheck disable=SC2016
if ! grep -q 'set $php_upstream singlepage-app:9000;' "$ROOT/docker-config/nginx/upstream.default.conf"; then
    echo 'FAIL: default upstream is not singlepage-app' >&2
    failures=$((failures + 1))
fi
# shellcheck disable=SC2016
if ! grep -q 'set $reverb_upstream singlepage-reverb:8080;' "$ROOT/docker-config/nginx/upstream.default.conf"; then
    echo 'FAIL: default reverb upstream is not singlepage-reverb' >&2
    failures=$((failures + 1))
fi
if [ ! -L "$ROOT/.deploy/nginx-upstream.conf" ]; then
    echo 'FAIL: .deploy/nginx-upstream.conf must be a symlink' >&2
    failures=$((failures + 1))
fi
if ! grep -q 'container_name: singlepage-app-green' "$ROOT/docker-compose.green.yml"; then
    echo 'FAIL: green compose file is missing singlepage-app-green' >&2
    failures=$((failures + 1))
fi
if grep -E '^[[:space:]]*(container_name: global-mysql|global-mysql:)' "$ROOT/docker-compose.green.yml"; then
    echo 'FAIL: green compose file must not define global-mysql' >&2
    failures=$((failures + 1))
fi
if grep -q 'artisan down' "$ROOT/scripts/deploy.sh" && ! grep -q 'DEPLOY_MAINTENANCE' "$ROOT/scripts/deploy.sh"; then
    echo 'FAIL: maintenance flag missing' >&2
    failures=$((failures + 1))
fi

help_out=$(bash "$ROOT/scripts/deploy.sh" --help)
if ! printf '%s\n' "$help_out" | grep -q -- '--maintenance'; then
    echo 'FAIL: --help does not mention --maintenance' >&2
    failures=$((failures + 1))
fi

CHANGED_FILES=(docker-compose.green.yml app/Foo.php)
if compose_file_changed; then
    echo 'FAIL: docker-compose.green.yml must not force an nginx recreate' >&2
    failures=$((failures + 1))
fi
CHANGED_FILES=(docker-compose.yml)
if ! compose_file_changed; then
    echo 'FAIL: docker-compose.yml should force an nginx recreate' >&2
    failures=$((failures + 1))
fi
# shellcheck disable=SC2034
CHANGED_FILES=()
if compose_file_changed; then
    echo 'FAIL: empty diff should not recreate nginx' >&2
    failures=$((failures + 1))
fi

# Test image_inputs_changed when docker is absent / inspect fails
OLD_SHA="80ea7e4"
NEW_SHA="984b60e"
DEPLOY_FORCE_BUILD=0
if ! image_inputs_changed; then
    echo "FAIL: image_inputs_changed should return 0 when docker inspect fails" >&2
    failures=$((failures + 1))
fi

# Mock docker for unit testing image_inputs_changed and remove_stale_incoming_image
docker() {
    case "$*" in
        "image inspect singlepage:incoming"*)
            if [ "${MOCK_INCOMING_EXISTS:-0}" -eq 1 ]; then
                echo "sha256:incoming123"
                return 0
            fi
            return 1
            ;;
        "image inspect singlepage"*)
            return 0
            ;;
        "ps -a -q --filter ancestor=sha256:incoming123"*)
            if [ "${MOCK_CONTAINER_USING:-0}" -eq 1 ]; then
                echo "container_xyz"
            fi
            return 0
            ;;
        "ps -a -q --filter ancestor=singlepage:incoming"*)
            return 0
            ;;
        "image rm singlepage:incoming"*)
            MOCK_RM_CALLED=1
            return 0
            ;;
        "build -t singlepage:incoming"*)
            MOCK_BUILD_CALLED=1
            return 0
            ;;
        "tag singlepage singlepage:incoming"*)
            MOCK_TAG_CALLED=1
            return 0
            ;;
    esac
    return 1
}

if image_inputs_changed; then
    echo "FAIL: image_inputs_changed should return 1 when inputs are unchanged" >&2
    failures=$((failures + 1))
fi

DEPLOY_FORCE_BUILD=1
if ! image_inputs_changed; then
    echo "FAIL: image_inputs_changed should return 0 when DEPLOY_FORCE_BUILD=1" >&2
    failures=$((failures + 1))
fi
DEPLOY_FORCE_BUILD=0

# Diff touching Dockerfile (compare empty tree 4b825dc642cb6eb9a060e54bf8d69288fbee4904 to HEAD)
OLD_SHA="4b825dc642cb6eb9a060e54bf8d69288fbee4904"
NEW_SHA="984b60e"
if ! image_inputs_changed; then
    echo "FAIL: image_inputs_changed should return 0 when Dockerfile changed" >&2
    failures=$((failures + 1))
fi

# Test remove_stale_incoming_image
MOCK_RM_CALLED=0
MOCK_INCOMING_EXISTS=0
MOCK_CONTAINER_USING=0
remove_stale_incoming_image >/dev/null 2>&1 || true
if [ "$MOCK_RM_CALLED" -ne 0 ]; then
    echo "FAIL: remove_stale_incoming_image should not remove non-existent image" >&2
    failures=$((failures + 1))
fi

MOCK_INCOMING_EXISTS=1
MOCK_CONTAINER_USING=1
remove_stale_incoming_image >/dev/null 2>&1 || true
if [ "$MOCK_RM_CALLED" -ne 0 ]; then
    echo "FAIL: remove_stale_incoming_image should not remove image in use by container" >&2
    failures=$((failures + 1))
fi

MOCK_INCOMING_EXISTS=1
MOCK_CONTAINER_USING=0
remove_stale_incoming_image >/dev/null 2>&1 || true
if [ "$MOCK_RM_CALLED" -ne 1 ]; then
    echo "FAIL: remove_stale_incoming_image should remove unused incoming image" >&2
    failures=$((failures + 1))
fi

# Test build_image
RELEASE_DIR="/tmp/mock-release-dir"
MOCK_BUILD_CALLED=0
MOCK_TAG_CALLED=0
OLD_SHA="80ea7e4"
NEW_SHA="984b60e"
DEPLOY_FORCE_BUILD=0
build_image >/dev/null 2>&1 || true
if [ "$MOCK_TAG_CALLED" -ne 1 ] || [ "$MOCK_BUILD_CALLED" -ne 0 ]; then
    echo "FAIL: build_image should tag live image when inputs unchanged" >&2
    failures=$((failures + 1))
fi

MOCK_BUILD_CALLED=0
MOCK_TAG_CALLED=0
DEPLOY_FORCE_BUILD=1
build_image >/dev/null 2>&1 || true
if [ "$MOCK_BUILD_CALLED" -ne 1 ] || [ "$MOCK_TAG_CALLED" -ne 0 ]; then
    echo "FAIL: build_image should docker build when image inputs changed" >&2
    failures=$((failures + 1))
fi
DEPLOY_FORCE_BUILD=0

unset -f docker

# Test require_free_disk
APP_DIR="$ROOT"
if ! require_free_disk 10 >/dev/null 2>&1; then
    echo "FAIL: require_free_disk 10 should succeed" >&2
    failures=$((failures + 1))
fi

if (APP_DIR="$ROOT" require_free_disk 99999999 >/dev/null 2>&1); then
    echo "FAIL: require_free_disk 99999999 should fail" >&2
    failures=$((failures + 1))
fi

if [ "$failures" -ne 0 ]; then
    printf '%s assertion(s) failed\n' "$failures" >&2
    exit 1
fi

echo "deploy classify tests passed"
