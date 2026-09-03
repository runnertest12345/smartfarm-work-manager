#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_ROOT="/srv/smartfarm-work-manager"
readonly RELEASES_DIR="${APP_ROOT}/releases"
readonly INCOMING_DIR="${APP_ROOT}/incoming"
readonly MAX_ARCHIVE_BYTES=$((64 * 1024 * 1024))
readonly MAX_EXTRACTED_BYTES=$((256 * 1024 * 1024))
readonly MAX_MEMBERS=20000
readonly RETAIN_RELEASES=5

archive_path="${1:-}"
release_id="${2:-}"

if [[ -z "${archive_path}" || -z "${release_id}" ]]; then
  echo "Usage: promote-smartfarm-release <archive.tar.gz> <release-id>" >&2
  exit 64
fi

if [[ ! "${release_id}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]]; then
  echo "Invalid release id: ${release_id}" >&2
  exit 64
fi

mkdir -p -- "${RELEASES_DIR}" "${INCOMING_DIR}"
chmod 0700 "${INCOMING_DIR}"

exec 9>"${APP_ROOT}/.promote.lock"
if ! flock --exclusive --nonblock 9; then
  echo "Another release promotion is already running." >&2
  exit 75
fi

incoming_real="$(realpath -e -- "${INCOMING_DIR}")"
if [[ ! -f "${archive_path}" || -L "${archive_path}" ]]; then
  echo "Archive is not a regular file: ${archive_path}" >&2
  exit 66
fi
archive_real="$(realpath -e -- "${archive_path}")"
if [[ "${archive_real}" != "${incoming_real}/"* ]]; then
  echo "Archive must be inside ${INCOMING_DIR}." >&2
  exit 66
fi

staging_dir=""
link_path="${APP_ROOT}/.current-${release_id}"
cleanup() {
  exit_code=$?
  trap - EXIT
  if [[ -n "${staging_dir}" ]]; then
    rm -rf -- "${staging_dir}"
  fi
  rm -f -- "${link_path}" "${archive_real}"
  exit "${exit_code}"
}
trap cleanup EXIT

archive_bytes="$(stat --format='%s' -- "${archive_real}")"
if (( archive_bytes <= 0 || archive_bytes > MAX_ARCHIVE_BYTES )); then
  echo "Archive exceeds the ${MAX_ARCHIVE_BYTES}-byte compressed size limit." >&2
  exit 65
fi

release_dir="${RELEASES_DIR}/${release_id}"
if [[ -e "${release_dir}" || -L "${release_dir}" ]]; then
  echo "Release already exists: ${release_id}" >&2
  exit 73
fi
if [[ -e "${link_path}" || -L "${link_path}" ]]; then
  echo "Temporary release link already exists: ${link_path}" >&2
  exit 73
fi

staging_dir="$(mktemp -d "${RELEASES_DIR}/.staging-${release_id}-XXXXXX")"

python3 - "${archive_real}" "${staging_dir}" "${MAX_MEMBERS}" "${MAX_EXTRACTED_BYTES}" <<'PY'
import os
import sys
import tarfile
from pathlib import Path, PurePosixPath

archive = Path(sys.argv[1])
destination = Path(sys.argv[2]).resolve(strict=True)
max_members = int(sys.argv[3])
max_bytes = int(sys.argv[4])

blocked_suffixes = {".key", ".p12", ".pem", ".pfx"}
validated: list[tuple[tarfile.TarInfo, PurePosixPath]] = []
seen: set[str] = set()
total_bytes = 0
has_root_index = False

with tarfile.open(archive, mode="r:gz") as bundle:
    members = bundle.getmembers()
    if not members or len(members) > max_members:
        raise SystemExit(f"Archive member count must be between 1 and {max_members}.")

    for member in members:
        if not (member.isfile() or member.isdir()):
            raise SystemExit(f"Unsupported archive member type: {member.name!r}")

        path = PurePosixPath(member.name)
        if path.is_absolute() or ".." in path.parts or len(member.name) > 4096:
            raise SystemExit(f"Unsafe archive path: {member.name!r}")

        normalized = path.as_posix()
        if normalized in {"", "."}:
            if not member.isdir():
                raise SystemExit("The archive root entry must be a directory.")
            continue
        if normalized in seen:
            raise SystemExit(f"Duplicate archive path: {normalized!r}")
        seen.add(normalized)

        target = destination.joinpath(*path.parts).resolve(strict=False)
        if os.path.commonpath((str(destination), str(target))) != str(destination):
            raise SystemExit(f"Archive path escapes the release root: {member.name!r}")

        if member.isfile():
            lower_name = path.name.casefold()
            if lower_name.startswith(".env") or path.suffix.casefold() in blocked_suffixes:
                raise SystemExit(f"Blocked file in static release: {member.name!r}")
            total_bytes += member.size
            if total_bytes > max_bytes:
                raise SystemExit(f"Expanded archive exceeds {max_bytes} bytes.")
            if normalized == "index.html":
                has_root_index = True

        validated.append((member, path))

    if not has_root_index:
        raise SystemExit("The archive does not contain index.html at its root.")

    for member, path in validated:
        target = destination.joinpath(*path.parts)
        if member.isdir():
            target.mkdir(mode=0o700, parents=True, exist_ok=True)
            continue

        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        source = bundle.extractfile(member)
        if source is None:
            raise SystemExit(f"Could not read archive member: {member.name!r}")

        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        descriptor = os.open(target, flags, 0o600)
        with source, os.fdopen(descriptor, "wb") as output:
            remaining = member.size
            while remaining:
                chunk = source.read(min(1024 * 1024, remaining))
                if not chunk:
                    raise SystemExit(f"Truncated archive member: {member.name!r}")
                output.write(chunk)
                remaining -= len(chunk)
PY

chmod -R u=rwX,go=rX "${staging_dir}"
mv -- "${staging_dir}" "${release_dir}"
staging_dir=""

ln -s "${release_dir}" "${link_path}"
mv -Tf -- "${link_path}" "${APP_ROOT}/current"

current_target="$(readlink -f -- "${APP_ROOT}/current")"
kept=0
while IFS= read -r -d '' release_entry; do
  candidate="${release_entry#*:}"
  candidate_name="$(basename -- "${candidate}")"
  if [[ "${candidate_name}" == "bootstrap" || "${candidate_name}" == .staging-* ]]; then
    continue
  fi
  if [[ ! "${candidate_name}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]]; then
    continue
  fi
  kept=$((kept + 1))
  if (( kept > RETAIN_RELEASES )) && [[ "${candidate}" != "${current_target}" ]]; then
    rm -rf -- "${candidate}"
  fi
done < <(
  find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d \
    -printf '%T@:%p\0' | sort --zero-terminated --numeric-sort --reverse
)

rm -f -- "${archive_real}"
trap - EXIT

echo "Promoted release ${release_id}."
