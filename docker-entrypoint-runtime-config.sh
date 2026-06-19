#!/bin/sh
set -eu

api_protocol="${API_PROTOCOL:-https}"
api_host="${API_HOST:-api.garamol.com}"
api_port="${API_PORT:-}"
api_base_url="${API_BASE_URL:-}"

if [ -z "$api_base_url" ]; then
  if [ -n "$api_port" ]; then
    api_base_url="${api_protocol}://${api_host}:${api_port}"
  else
    api_base_url="${api_protocol}://${api_host}"
  fi
fi

cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  apiProtocol: "${api_protocol}",
  apiHost: "${api_host}",
  apiPort: "${api_port}",
  apiBaseUrl: "${api_base_url}"
};
EOF
