#!/bin/bash

# Ensure the script exits on any error
set -e

# Regular container execution
echo "Main container: Checking shared docroot population..."

if [ ! -d "/var/www/html/docroot" ] || [ -z "$(ls -A /var/www/html/docroot)" ]; then
  echo "Error: /var/www/html/docroot is not populated. Init container may have failed."
  exit 1
else
  echo "docroot is populated. Continuing..."
fi


echo "Waiting for MySQL to be ready..."

until mysqladmin --host=${DB_HOST} --port=${DB_PORT} --user=${DB_USER} --password=${DB_PASSWORD} ping | grep -q "mysqld is alive"; do
    sleep 2
done

echo "MySQL is up and running!"

# generate a local config file if it doesn't exist.
# This is needed to ensure the db credentials can be prefilled in the UI, as env vars aren't taken into account.
# Generate Mautic configuration from environment variables if it doesn't exist
if [ ! -f /var/www/html/config/local.php ]; then
    echo "Generating Mautic configuration file..."
    su -s /bin/bash www-data -c 'mkdir -p /var/www/html/config'

    cat <<'EOF' > /var/www/html/config/local.php
<?php
$parameters = array( 
    'db_driver'      => 'pdo_mysql',
    'db_host'        => getenv('DB_HOST'),
    'db_port'        => getenv('DB_PORT'),
    'db_name'        => getenv('DB_NAME'),
    'db_user'        => getenv('DB_USER'),
    'db_password'    => getenv('DB_PASSWORD'),
    'db_table_prefix'=> null,
    'db_backup_tables' => 1,
    'db_backup_prefix' => 'bak_',
    'mailer_transport' => 'smtp',
    'site_url'       => getenv('SITE_URL'),
    'locale'         => 'en',
);
EOF
chown www-data:www-data /var/www/html/config/local.php

fi


# Run database migrations if configured
if [ "\$DOCKER_MAUTIC_RUN_MIGRATIONS" = "true" ]; then
    echo "Running database migrations..."
    su -s /bin/bash www-data -c 'php /var/www/html/docroot/bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration'
fi



# Start PHP-FPM
echo "Starting PHP-FPM..."
exec "$@"
