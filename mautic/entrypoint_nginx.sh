#!/bin/sh
set -e
echo "MAUTIC_WEB_URL is set to: $MAUTIC_WEB_URL" >&2
# Create log directory
mkdir -p /var/log/nginx 
touch /var/log/nginx/access.log /var/log/nginx/error.log 
chmod -R 755 /var/log/nginx
envsubst '$MAUTIC_WEB_URL' < /etc/nginx/templates/nginx.conf.template  > /etc/nginx/nginx.conf
envsubst '$MAUTIC_WEB_URL' < /etc/nginx/templates/default.conf.template  > /etc/nginx/conf.d/default.conf
envsubst '$MAUTIC_WEB_URL' < /etc/nginx/templates/fastcgi-php-nginx.conf.template   > /etc/nginx/conf.d/fastcgi-php-nginx.conf
exec nginx -g 'daemon off;'
