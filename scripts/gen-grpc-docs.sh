#!/usr/bin/env bash
# Generate HTML + Markdown docs from chat3_user.proto (protoc-gen-doc).
# Requires Docker. Output: docs/grpc/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROTO_DIR="$ROOT/packages-shared/proto/src"
OUT_DIR="$ROOT/docs/grpc"
IMAGE="${PROTOC_GEN_DOC_IMAGE:-pseudomuto/protoc-gen-doc:1.5.1}"
USER_FLAG=()
if [[ "$(id -u)" != "0" ]]; then
  USER_FLAG=(--user "$(id -u):$(id -g)")
fi

mkdir -p "$OUT_DIR"

run_gen() {
  local opt="$1"
  # Image writes into mounted /out by default (do not pass -o /out).
  docker run --rm \
    "${USER_FLAG[@]}" \
    -v "$PROTO_DIR:/protos:ro" \
    -v "$OUT_DIR:/out" \
    "$IMAGE" \
    -I /protos \
    --doc_opt="$opt" \
    chat3_user.proto
}

run_gen "html,index.html"
run_gen "markdown,chat3_user.md"

cat > "$OUT_DIR/README.md" <<'EOF'
# Chat3 User gRPC docs

Generated from `packages-shared/proto/src/chat3_user.proto`.

- [HTML](./index.html) — browse locally or via CI artifact
- [Markdown](./chat3_user.md)

Regenerate:

```bash
./scripts/gen-grpc-docs.sh
```

Do not hand-edit `index.html` / `chat3_user.md`; change the `.proto` and re-run the script.

Local interactive UI (run_local): http://localhost:5080 (grpcui + reflection).
EOF

echo "Wrote $OUT_DIR/index.html and $OUT_DIR/chat3_user.md"
