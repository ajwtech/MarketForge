#!/bin/sh
set -e
echo "MAUTIC_WEB_URL is set to: $MAUTIC_WEB_URL" >&2
# Create log directory
mkdir -p /var/log/nginx 
touch /var/log/nginx/access.log /var/log/nginx/error.log 
chmod -R 755 /var/log/nginx

exec nginx -g 'daemon off;'
