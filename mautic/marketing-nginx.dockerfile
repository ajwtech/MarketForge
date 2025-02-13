# nginx.dockerfile
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


ARG ${APP_VERSION:-'5.2.1'}

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
        imap-dev \
    && apk add --no-cache \
        ca-certificates \
        curl \
        php83-imap \
        imagemagick \
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
ENV SSH_PASSWD="root:Docker!"

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
    COMPOSER_ALLOW_SUPERUSER=1 composer dump-env prod && \
    npm cache clean --force && \
    apk del .build-deps


# Stage 3: Production
FROM nginx:mainline-alpine3.20-slim

ARG ${APP_VERSION:-'5.2.1'}

# Install envsubst
RUN apk update && apk add gettext

# Create Mautic docroot directory
RUN addgroup -g 82 -S www-data || true && adduser -u 82 -S www-data -G www-data || true && \
    mkdir -p /var/www/html/
WORKDIR /var/www/html

COPY --from=builder --chown=www-data:www-data /opt/mautic /var/www/html
RUN chmod -R 755 /var/www/html/docroot

# Create vTiger directory
RUN addgroup -g 82 -S www-data || true && adduser -u 82 -S www-data -G www-data || true && \
    mkdir -p /var/vtiger/www/html/

# Copy application files into the container
COPY vtigercrm/vtigercrm/ /var/vtiger/www/html 
RUN chown -R www-data:www-data /var/vtiger/www/html && \
    chmod -R 755 /var/vtiger/www/html

RUN mkdir /etc/nginx/utils.d && \
    chmod -R 755 /etc/nginx/utils.d


#utility configs
COPY ./mautic/nginx.configd/fastcgi-params.conf /etc/nginx/utils.d/fastcgi-params.conf
COPY ./mautic/nginx.configd/options-gzip-nginx.conf /etc/nginx/utils.d/options-gzip-nginx.conf
COPY ./mautic/nginx.configd/options-ssl-nginx.conf /etc/nginx/utils.d/options-ssl-nginx.conf
COPY ./mautic/nginx.configd/fastcgi-php-nginx.conf /etc/nginx/utils.d/fastcgi-php-nginx.conf 

#server configs
COPY ./mautic/nginx.configd/mauticdemo.nginx.conf /etc/nginx/conf.d/default.conf
COPY ./mautic/nginx.configd/strapi.conf /etc/nginx/conf.d/strapi.conf
COPY ./mautic/nginx.configd/vtiger.conf /etc/nginx/conf.d/vtiger.conf

#configs with templates
COPY ./mautic/nginx.configd/nginx.conf /etc/nginx/templates/nginx.conf.template

# Copy startup script
COPY ./mautic/entrypoint_nginx.sh /entrypoint_nginx.sh
RUN chmod +x /entrypoint_nginx.sh

# Create log directory
RUN mkdir -p /var/log/nginx && \
    mkdir -p /data/nginx/cache && \
    touch /var/log/nginx/access.log /var/log/nginx/error.log && \
    chmod -R 755 /var/log/nginx

# Expose port
EXPOSE 80

# Set entrypoint
ENTRYPOINT ["/entrypoint_nginx.sh"]