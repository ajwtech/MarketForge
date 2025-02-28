#!/bin/sh
set -e
echo "MAUTIC_WEB_URL is set to: ${MAUTIC_WEB_URL}" >&2
echo "SUITECRM_APP_URL is set to: ${SUITECRM_APP_URL}" >&2
echo "STRAPI_APP_URL is set to: ${STRAPI_APP_URL}" >&2
# Create log directory
mkdir -p /var/log/nginx 
touch /var/log/nginx/access.log /var/log/nginx/error.log 
chmod -R 755 /var/log/nginx
envsubst '${MAUTIC_WEB_URL} ${SUITECRM_APP_URL} ${STRAPI_APP_URL}' < /etc/nginx/templates/nginx.conf.template  > /etc/nginx/nginx.conf
exec nginx -g 'daemon off;'
