#!/bin/sh
set -e

# Echo service URLs for debugging
echo "MAUTIC_WEB_URL is set to: ${MAUTIC_WEB_URL}"
echo "SUITECRM_APP_URL is set to: ${SUITECRM_APP_URL}"
echo "STRAPI_APP_URL is set to: ${STRAPI_APP_URL}"
echo "DEV_STRAPI_APP_URL is set to: ${DEV_STRAPI_APP_URL}"

# Use default values only if not already set from mauticNginx.ts
: ${NGINX_LOGGING_ENABLED:=on}
: ${NGINX_ACCESS_LOG_ENABLED:=$NGINX_LOGGING_ENABLED}
: ${NGINX_ERROR_LOG_ENABLED:=$NGINX_LOGGING_ENABLED}
: ${NGINX_DEBUG_LOG_ENABLED:=off}
: ${NGINX_STATIC_LOG_ENABLED:=off}

echo "Configuring Nginx with logging level: $NGINX_LOGGING_ENABLED"

# Create log directory
mkdir -p /var/log/nginx
touch /var/log/nginx/access.log /var/log/nginx/error.log
chmod -R 755 /var/log/nginx

# Process the main nginx.conf template
envsubst '${MAUTIC_WEB_URL} ${STRAPI_APP_URL} ${DEV_STRAPI_APP_URL} ${SUITECRM_APP_URL} ${FRONTEND_APP_URL}' \
  < /etc/nginx/templates/nginx.conf.template > /etc/nginx/nginx.conf

# Process the logging.conf template
# This ensures environment variables are substituted into nginx variables
mkdir -p /etc/nginx/utils.d
envsubst '${NGINX_LOGGING_ENABLED} ${NGINX_ACCESS_LOG_ENABLED} ${NGINX_ERROR_LOG_ENABLED} ${NGINX_DEBUG_LOG_ENABLED} ${NGINX_STATIC_LOG_ENABLED}' \
  < /etc/nginx/templates/logging.conf.template > /etc/nginx/utils.d/logging.conf

# Start nginx
echo "Starting Nginx..."
exec nginx -g 'daemon off;'
