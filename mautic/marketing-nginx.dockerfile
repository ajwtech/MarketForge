# nginx.dockerfile

FROM nginx:mainline-alpine3.20-slim

# Install envsubst
RUN apk update && apk add gettext

# Copy template nginx.conf
COPY ./nginx.conf.template /etc/nginx/conf.d/nginx.conf.template

# Copy startup script
COPY ./entrypoint_nginx.sh /entrypoint_nginx.sh
RUN chmod +x /entrypoint_nginx.sh

# Create docroot directory
RUN mkdir -p /var/www/html/docroot

# Create log directory
RUN mkdir -p /var/log/nginx && \
    touch /var/log/nginx/access.log /var/log/nginx/error.log && \
    chmod -R 755 /var/log/nginx

# Expose port
EXPOSE 80

# Set entrypoint
ENTRYPOINT ["/entrypoint_nginx.sh"]