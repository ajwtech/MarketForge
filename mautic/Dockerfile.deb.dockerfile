#Stage 0: Base
FROM node:lts-bookworm-slim AS node
# Stage 1: Composer
FROM composer:latest AS composer
# Stage 2: Builder
FROM php:8.1-fpm AS builder

    # Copy Composer and node from the earlier images
    COPY --from=composer /usr/bin/composer /usr/bin/composer
    COPY --from=node /usr/local/bin/node /usr/local/bin/
    COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules/

    # Define build-time arguments with default values
    ARG APP_ENV=prod
    ARG DB_HOST=mysql
    ARG DB_PORT=3306
    ARG DB_NAME=mauticdb
    ARG DB_USER=root
    ARG DB_PASSWORD=password
    ARG APP_SECRET=defaultsecret
    ARG APP_VERSION=5.1.1

    # Assign build arguments to environment variables
    ENV APP_ENV=${APP_ENV} \
        DB_HOST=${DB_HOST} \
        DB_PORT=${DB_PORT} \
        DB_NAME=${DB_NAME} \
        DB_USER=${DB_USER} \
        DB_PASSWORD=${DB_PASSWORD} \
        APP_SECRET=${APP_SECRET} \
        NODE_ENV=production \
        PATH="/usr/local/bin:/usr/local/lib/node_modules/.bin:${PATH}" \
        CI=true

    RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
        
    # Install PHP extensions
    RUN apt-get update && apt-get install --no-install-recommends -y \
        ca-certificates \
        build-essential  \
        brotli \
        git \
        curl \
        libcurl4-gnutls-dev \
        libc-client-dev \
        libkrb5-dev \
        libmcrypt-dev \
        libssl-dev \
        libxml2-dev \
        libzip-dev \
        libjpeg-dev \
        libmagickwand-dev \
        libpng-dev \
        libgif-dev \
        libtiff-dev \
        libz-dev \
        libpq-dev \
        imagemagick \
        graphicsmagick \
        libwebp-dev \
        libjpeg62-turbo-dev \
        libxpm-dev \
        libaprutil1-dev \
        libicu-dev \
        libfreetype6-dev \
        libonig-dev \
        librabbitmq-dev \
        unzip \
        && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
        && rm -rf /var/lib/apt/lists/* \
        && rm /etc/cron.daily/*


    RUN curl -L -o /tmp/amqp.tar.gz "https://github.com/php-amqp/php-amqp/archive/refs/tags/v2.1.1.tar.gz" \
        && mkdir -p /usr/src/php/ext/amqp \
        && tar -C /usr/src/php/ext/amqp -zxvf /tmp/amqp.tar.gz --strip 1 \
        && rm /tmp/amqp.tar.gz

    # Configure, install, and enable PHP extensions in a single RUN statement
    RUN apt-get update && apt-get install --no-install-recommends -y \
            libfreetype6-dev \
            libjpeg62-turbo-dev \
        && docker-php-ext-configure gd --with-freetype --with-jpeg \
        && docker-php-ext-configure imap --with-kerberos --with-imap-ssl \
        && docker-php-ext-configure opcache --enable-opcache \
        && docker-php-ext-install -j$(nproc) intl mbstring mysqli curl pdo_mysql zip bcmath sockets exif amqp gd imap opcache \
        && docker-php-ext-enable intl mbstring mysqli curl pdo_mysql zip bcmath sockets exif amqp gd imap opcache \
        && apt-get clean && rm -rf /var/lib/apt/lists/*

    RUN echo "memory_limit = -1" > /usr/local/etc/php/php.ini
    
    #set the working directory to the selected app version

    WORKDIR /opt/${APP_VERSION}

    RUN COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_PROCESS_TIMEOUT=10000 composer create-project mautic/recommended-project:^${APP_VERSION} . \
        --no-interaction --prefer-install=auto --no-scripts
    RUN npm install -g npx
    RUN npm install --include=dev 
    RUN COMPOSER_ALLOW_SUPERUSER=1 composer require --dev --no-scripts\
    symfony/web-profiler-bundle \
    symfony/maker-bundle \
    symfony/debug-bundle \
    symfony/var-dumper \
    symfony/flex

    RUN COMPOSER_ALLOW_SUPERUSER=1 composer install --no-interaction --no-scripts --dev

    RUN php bin/console mautic:assets:generate

    RUN npx patch-package 

   RUN    find node_modules -mindepth 1 -maxdepth 1 -not \( -name 'jquery' -or -name 'vimeo-froogaloop2'  \) | xargs rm -rf

   RUN COMPOSER_ALLOW_SUPERUSER=1 composer dump-env prod

    # Stage 3: Production
    FROM php:8.1-fpm

    RUN echo "memory_limit = 512M" > /usr/local/etc/php/php.ini
    RUN echo "date.timezone = America/New_York" >> /usr/local/etc/php/php.ini
    RUN echo "zend.assertions = -1" >> /usr/local/etc/php/php.ini
    ARG APP_VERSION=5.1.1
    
    WORKDIR /var/www/html
    # Copy PHP extensions and configuration from builder
    COPY --from=builder /usr/local/lib/php/extensions /usr/local/lib/php/extensions
    COPY --from=builder /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/

    #COPY --from=builder --chown=www-data:www-data /opt/mauticapp/mautic /var/www/html
    # Updated COPY command
   COPY --from=builder --chown=www-data:www-data /opt/${APP_VERSION}/ /var/www/html/

    # Install PHP extensions requirements and other dependencies
    RUN apt-get update && apt-get install --no-install-recommends -y \
        bash unzip libwebp-dev libzip-dev libfreetype6-dev libjpeg62-turbo-dev libpng-dev libc-client-dev librabbitmq4 \
        mariadb-client supervisor cron libfcgi-bin \
        && apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
        && rm -rf /var/lib/apt/lists/* \
        && rm /etc/cron.daily/*

    # Setting PHP properties
    ENV PHP_INI_VALUE_DATE_TIMEZONE='UTC' \
        PHP_INI_VALUE_MEMORY_LIMIT=512M \
        PHP_INI_VALUE_UPLOAD_MAX_FILESIZE=512M \
        PHP_INI_VALUE_POST_MAX_FILESIZE=512M \
        PHP_INI_VALUE_MAX_EXECUTION_TIME=300

    #COPY php.ini /usr/local/etc/php/php.ini

    COPY ./docker-entrypoint.sh /entrypoint.sh
    COPY ./entrypoint_mautic_web.sh /entrypoint_mautic_web.sh
    COPY ./entrypoint_mautic_cron.sh /entrypoint_mautic_cron.sh
    COPY ./entrypoint_mautic_worker.sh /entrypoint_mautic_worker.sh

    # Apply necessary permissions
    RUN chmod +x /entrypoint.sh /entrypoint_mautic_web.sh /entrypoint_mautic_cron.sh /entrypoint_mautic_worker.sh

    # Setting worker env vars
    ENV DOCKER_MAUTIC_WORKERS_CONSUME_EMAIL=2 \
        DOCKER_MAUTIC_WORKERS_CONSUME_HIT=2 \
        DOCKER_MAUTIC_WORKERS_CONSUME_FAILED=2

    #COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf


    # Define Mautic volumes to persist data
    VOLUME /var/www/html/config
    VOLUME /var/www/html/var/logs
    VOLUME /var/www/html/media
    

    # Define the entrypoint
    ENTRYPOINT ["/entrypoint.sh"]

    CMD ["php-fpm"]
