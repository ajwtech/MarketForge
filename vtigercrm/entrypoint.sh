#!/bin/sh

# Ensure the script exits on any error
set -e

# Regular container execution
echo "Main container: Checking application population..."

if [ ! -d "/var/vtiger/www/html/" ] || [ -z "$(ls -A /var/vtiger/www/html/)" ]; then
  echo "Error: /var/vtiger/www/html/ is not populated. Exiting..."
  exit 1
else
  echo "docroot is populated. Continuing..."
fi

echo "Waiting for MySQL to be ready..."
echo "DB_HOST: ${DB_HOST}"
echo "DB_NAME: ${DB_NAME}"
echo "DB_PORT: ${DB_PORT}"
echo "DB_USER: ${DB_USER}"
until mysqladmin --host=${DB_HOST} --port=${DB_PORT} --user=${DB_USER} --password=${DB_PASSWORD} ping | grep -q "mysqld is alive"; do
    sleep 2
done

# envsubst '${DB_HOST} ${DB_PORT} ${DB_USER} ${DB_PASSWORD} ${DB_NAME} ${dbType} ${SITE_URL} '  < config.template.php > config.php
envsubst '${DB_HOST} ${DB_PORT} ${DB_USER} ${DB_PASSWORD} ${DB_NAME} ${DB_TYPE} ${SITE_URL} '  < config.db.template.php > config.db.php

echo "Connection Successful: MySQL is up and running!"

composer install

# Start PHP-FPM
echo "Starting PHP-FPM..."
exec "$@"
