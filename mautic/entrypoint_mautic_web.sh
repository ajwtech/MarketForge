#!/bin/bash

# Ensure the script exits on any error
set -e

# Regular container execution
echo "Main container: Checking shared docroot population..."

if [ ! -d "/var/www/html/docroot" ] || [ -z "$(ls -A /var/www/html/docroot)" ]; then
  echo "Error: /var/www/html/docroot is not populated."
  exit 1
else
  echo "docroot is populated. Continuing..."
fi

if [ ! -s /var/www/html/config/local.php ]; then
  echo "Generating Mautic configuration file..."
  envsubst '${DB_HOST} ${DB_PORT} ${DB_NAME} ${DB_USER} ${DB_PASSWORD} ${SITE_URL}' < local.php.conf > /var/www/html/config/local.php
  chown www-data:www-data /var/www/html/config/local.php
else
  echo "Mautic configuration file already exists. Skipping..."
fi
if [ ! -s /var/www/html/config/local.php ]; then
  echo "Generating Mautic configuration file..."
  envsubst '${DB_HOST} ${DB_PORT} ${DB_NAME} ${DB_USER} ${DB_PASSWORD} ${SITE_URL}' < local.php.conf > /var/www/html/config/config_production.php
  chown www-data:www-data /var/www/html/config/local.php
else
  echo "Mautic configuration file already exists. Skipping..."
fi

echo "Waiting for MySQL to be ready..."

until mysqladmin --host=${DB_HOST} --port=${DB_PORT} --user=${DB_USER} --password=${DB_PASSWORD} ping | grep -q "mysqld is alive"; do
    sleep 2
done

echo "MySQL is up and running!"

# #TODO fix this so we are not running installs on every start. 
# echo "Installing marketplace plugins..."
# su -s /bin/bash www-data -c 'php /var/www/html/bin/console mautic:marketplace:install acquia/mc-cs-plugin-custom-objects --no-interaction'

# echo "Running database migrations..."
# su -s /bin/bash www-data -c 'php /var/www/html/bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration'


# #nicely run the migrations
# echo "Checking for pending database migrations..."
# migration_status=$(su -s /bin/bash www-data -c 'php /var/www/html/bin/console doctrine:migrations:status --no-interaction')
# # Look for the line "New Migrations:" to determine if any pending migrations exist.
# new_migrations=$(echo "$migration_status" | grep "New Migrations:" | awk '{print $NF}')
# if [ "$new_migrations" -gt 0 ]; then
#     echo "Pending migrations found ($new_migrations), running migrations..."
#     su -s /bin/bash www-data -c 'php /var/www/html/bin/console doctrine:migrations:migrate --no-interaction'
# else
#     echo "No pending migrations found. Skipping."
# fi



# Start PHP-FPM
echo "Starting PHP-FPM..."
exec "$@"
