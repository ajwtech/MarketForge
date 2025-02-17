#Stage 0: Base
FROM node:lts-alpine3.20 AS node
# Stage 1: Composer
FROM composer/composer:2.8-bin AS composer
# Stage 2: Builder
FROM php:8.3.16-fpm-alpine3.20 AS builder

# Copy Composer and node from the earlier images
COPY --from=composer /composer /usr/bin/composer
COPY --from=node /usr/local/bin/node /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules/

ARG ${APP_VERSION:-'5.2.2'}

# Assign build arguments to environment variables
ENV NODE_ENV=production \
    PATH="/usr/local/bin:/usr/local/lib/node_modules/.bin:${PATH}" 

RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && \
    # Install dev/build dependencies
    apk update && apk add --no-cache --virtual .build-deps \
        rabbitmq-c-dev \
        imap-dev \
        build-base \
        brotli \
        git \
        curl-dev \
        krb5-dev \
        openssl-dev \
        libxml2-dev \
        libzip-dev \
        libjpeg-turbo-dev \
        imagemagick-dev \
        libpng-dev \
        giflib-dev \
        zlib-dev \
        libwebp-dev \
        libxpm-dev \
        apr-util-dev \
        icu-dev \
        freetype-dev \
        oniguruma-dev \
        linux-headers \
    && apk add --no-cache \
        ca-certificates \
        curl \
        imagemagick \
        php83-imap \
        graphicsmagick \
        unzip \
        supervisor \
        fcgi \
        mysql-client \
        mariadb-connector-c \
        php83-intl \
        dialog \
        openssh-server \
        cronie \
        #Configure php
    && curl -L -o /tmp/amqp.tar.gz "https://github.com/php-amqp/php-amqp/archive/refs/tags/v2.1.2.tar.gz" \
    && mkdir -p /usr/src/php/ext/amqp \
    && tar -C /usr/src/php/ext/amqp -zxvf /tmp/amqp.tar.gz --strip 1 \
    && rm /tmp/amqp.tar.gz \
    # Configure, install, and enable PHP extensions 
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-configure imap --with-kerberos --with-imap-ssl \
    && docker-php-ext-configure opcache --enable-opcache \
    && docker-php-ext-install -j$(nproc) intl mbstring mysqli curl pdo_mysql zip bcmath sockets exif amqp gd imap opcache \
    && docker-php-ext-enable intl mbstring mysqli curl pdo_mysql zip bcmath sockets exif amqp gd imap opcache \
    && echo "memory_limit = -1" > /usr/local/etc/php/php.ini
    
# ssh
ENV  SSH_PASSWD="root:Docker!"

RUN echo "$SSH_PASSWD" | chpasswd 


#set the working directory to the selected app version

WORKDIR /opt/
# this is where it gets complicated. Composer for php and npm for node are configured in the reccomended project in a way that causes a catch 22 for a new instance of the project. Essentially the post install scripts in each one are dependent on the other being installed first. So this is how I am going to handle it. 
# First I will install the reccomended project with composer include the dev dependencies and disable the scripts. note that the app version is parameterized so the mautic folder will have versioned subfolders to assist in future updates and rollbacks. This has to be the first step because the npm install depends on the packages.json from the recommended project. npx is also required for the post install scripts to eventually run.
# Now when the npm install is run it will have npx needed by composer and the packages.json needed by npm. The npm post install script will run which will allow us to add the additional dev dependencies but we still need to disable the scripts because on a new system they will need to execute in a different order. Generate Assets, and patch-package need to run first.which will then complete the build. 
RUN COMPOSER_ALLOW_SUPERUSER=1 COMPOSER_PROCESS_TIMEOUT=10000 composer create-project mautic/recommended-project ${APP_VERSION} mautic \
        --no-interaction --prefer-install=auto --no-scripts && \
    cd mautic && \
    npm install -g npx && \
    npm install --include=dev && \
    COMPOSER_ALLOW_SUPERUSER=1 composer require --dev --no-scripts\
    symfony/web-profiler-bundle \
    symfony/maker-bundle \
    symfony/debug-bundle \
    symfony/var-dumper \
    symfony/flex && \
    COMPOSER_ALLOW_SUPERUSER=1 composer install --no-interaction --no-scripts --dev --optimize-autoloader && \
    php bin/console mautic:assets:generate && \
    npx patch-package && \
    find node_modules -mindepth 1 -maxdepth 1 -not \( -name 'jquery' -or -name 'vimeo-froogaloop2'  \) | xargs rm -rf && \
    composer require acquia/mc-cs-plugin-custom-objects --no-interaction --no-scripts && \
    COMPOSER_ALLOW_SUPERUSER=1 composer dump-env prod && \
    npm cache clean --force && \
    apk del .build-deps


# Stage 3: Production
FROM php:8.3.16-fpm-alpine3.20

ARG ${APP_VERSION:-'5.2.2'}

# Create log directories for PHP-FPM
RUN mkdir -p /var/log/php-fpm && \
    touch /var/log/php-fpm/error.log /var/log/php-fpm/access.log && \
    chmod -R 755 /var/log/php-fpm


WORKDIR /var/www/html
# Copy PHP extensions and configuration from builder
COPY --from=builder /usr/local/lib/php/extensions /usr/local/lib/php/extensions
COPY --from=builder /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/

# Updated COPY command
COPY --from=builder --chown=www-data:www-data /opt/mautic /var/www/html

# Install PHP extensions requirements and other dependencies
RUN apk update && apk add --no-cache \
bash \
curl \
gettext \
imap-dev \
unzip \
libwebp \
libzip \
freetype \
libjpeg-turbo \
libpng \
rabbitmq-c \
php83-pdo_mysql \
supervisor \
fcgi \
linux-headers \
mysql-client \
mariadb-connector-c \
php83-intl \
php83-imap \
&& docker-php-ext-install imap \
&& docker-php-ext-enable amqp

# Copy configuration files to their correct locations
COPY ./php.ini /usr/local/etc/php/php.ini
COPY ./www.conf /usr/local/etc/php-fpm.d/www.conf
COPY ./entrypoint_mautic_web.sh /entrypoint_mautic_web.sh
COPY ./docker-entrypoint.sh /entrypoint.sh
COPY --chown=www-data:www-data ./local.php.conf /var/www/html/local.php.conf

# Apply necessary permissions
RUN chmod +x /entrypoint.sh /entrypoint_mautic_web.sh

# #install from marketplace
# RUN php -vvv bin/console mautic:marketplace:install acquia/mc-cs-plugin-custom-objects 


EXPOSE 9000
# Define the entrypoint
ENTRYPOINT ["/entrypoint.sh"]

CMD ["php-fpm"]
