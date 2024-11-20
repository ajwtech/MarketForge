#!/bin/sh
set -e
echo "MAUTIC_WEB_URL is set to: $MAUTIC_WEB_URL" >&2
envsubst '$MAUTIC_WEB_URL' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'