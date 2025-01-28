# Nginx FastCGI response buffer sizes

1. [Introduction](#introduction)
1. [Buffers? Meh](#buffers-meh)
1. [Determine actual FastCGI response sizes](#determine-actual-fastcgi-response-sizes)
   1. [Creating a filtered access.log for FastCGI](#creating-a-filtered-accesslog-for-fastcgi)
   1. [Default memory pagesize](#default-memory-pagesize)
1. [Setting the buffer size](#setting-the-buffer-size)
1. [Verifying our results](#verifying-our-results)
   1. [Warning: Do NOT try to stuff all your `fastcgi_buffers` responses into memory](#warning-do-not-try-to-stuff-all-your-fastcgi_buffers-responses-into-memory)
1. [Updated config snippet](#updated-config-snippet)

>Permanent link to this document: [Setting Nginx FastCGI response buffer sizes](http://bit.ly/nginx_fastcgi_buffers)
>
>Shoutout to [Peter Mescalchin (@magnetikonline)](@magnetikonline) for the [original Gist](https://gist.github.com/magnetikonline/11312172).

**NB** configs in this Markdown may not be current.  The included files are up-to-date.

## Introduction

By default when Nginx starts receiving a response from a FastCGI backend (such as [PHP-FPM](https://php.net/manual/en/install.fpm.php)) it will buffer the response in memory before delivering it to the client. Any response larger than the set buffer size is saved to a temporary file on disk.

This process is outlined at the Nginx [ngx_http_fastcgi_module](<https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_buffering>) manual page.

## Buffers? Meh

Since disk is *slow* and memory is **fast** the aim is to get as many FastCGI responses passing only through memory. On the flip side we don't want to set an excessively large buffer as they are created and sized on a *per request basis* - it's **not** shared.

The related Nginx options are:

- [`fastcgi_buffering`](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_buffering) first appeared in Nginx 1.5.6 (1.6.0 stable) and can be used to turn buffering completely on/off. It's **on** by default.
- [`fastcgi_buffer_size`](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_buffer_size) is a special buffer space used to hold the _first chunk_ of the FastCGI response, which is going to be the HTTP response headers.

    You shouldn't need to adjust this from the default - even if Nginx defaults to the smallest page size of 4KB (your platform will determine if `4/8k` buffer) it should fit your typical HTTP header.

    One exception is frameworks that push large amounts of cookie data via the `Set-Cookie` HTTP header during their user verification/login phase - blowing out the buffer and resulting in a HTTP 500 error. In those instances you will need to *increase* this buffer to `8k/16k/32k` to fully accommodate your largest upstream HTTP header being pushed.

- **[`fastcgi_buffers`](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_buffers)** controls the number and memory size of buffer segments used for the payload of the FastCGI response.

Most, if not all of our tweaking will be based on the **`fastcgi_buffers`** directive for the remainder of this guide.

## Determine actual FastCGI response sizes

By processing our Nginx access logs we can determine both maximum and average response sizes.  The basis of this `awk` recipe was [found here](https://easyengine.io/tutorials/nginx/tweaking-fastcgi-buffers/).

```sh
awk '($10~/200/) {i++;sum+=$11;max=$11>max?$11:max;} END {printf("Maximum=%d\nAverage=%d\n",max,i?sum/i:0);}' access.log
```

```verilog
Maximum: 575458
Average: 10215
```

### Creating a filtered access.log for FastCGI

**Note:** this recipe are going to report on **all** access requests returning an `HTTP 200` code, you might want to filter FastCGI requests into a separate Nginx access logfile for reporting.  For example, for `PHP-FPM`:

```nginx
    location ~ \.php$ {
        include /etc/nginx/snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php7.0-fpm.sock;

        # Not required permanently. Output FastCGI requests to it's own Nginx log file
        access_log /var/log/nginx/phpfpmonly-access.log;
    }
```

Process the access requests from the newly configured `php-fpm-access.log`:

```sh
awk '($10~/200/) {i++;sum+=$11;max=$11>max?$11:max;} END {printf("Maximum=%d\nAverage=%d\n",max,i?sum/i:0);}' phpfpm-access.log
```

```verilog
Maximum: 569990
Average: 11820
```

### Default memory pagesize

The default memory pagesize (in bytes) for an operating system can be determined by the following command:

```sh
$ getconf PAGESIZE
4096
```

With these values in hand we are now much better equipped to set `fastcgi_buffers`.

## Setting the buffer size

The [`fastcgi_buffers`](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_buffers) setting takes two values, buffer segment count and memory size, by default it will be:

```nginx
fastcgi_buffers 8 4k|8k;
```

So a total of 8 buffer segments at either `4k/8k`, which is determined by the platform memory page size.
For Debian/Ubuntu Linux that turns out to be `4096` bytes (4K) - so a default total buffer size of **32KB**.

Based on the maximum/average response sizes [determined above](#determine-actual-fastcgi-response-sizes) we can now raise/lower these values to suit. Typically you would keep buffer size at the default value (memory pagesize) and adjust the *buffer segment count* to a value that keeps the bulk of responses handled by FastCGI loaded in buffer RAM.

If your response size averages are on the higher side, consider **lowering** the *buffer segment count* and **increasing** the **memory size** in pagesize multiples (`8k/16k/32k`).

## Verifying our results

We can see how often FastCGI responses are being saved to disk by grepping our Nginx error log(s):

```sh
grep --extended-regexp "\[warn\].+buffered" error.log
# or the older gzipped files
zgrep --extended-regexp "\[warn\].+buffered" error.log.2.gz

# will return lines like:
YYYY/MM/DD HH:MM:SS [warn] 1234#0: *123456 an upstream response is buffered to a temporary file...
```

Remember it's not necessarily a bad situation to have *some* larger responses buffered to disk. Aim for a balance where only a small portion of your largest responses are handled in this way.

### Warning: Do NOT try to stuff all your [`fastcgi_buffers`](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_buffers)  responses into memory

>WARNING: The practice of ramping up **`fastcgi_buffers`** to an excessive number and/or size value in an attempt to fit all FastCGI responses purely in RAM is something [Peter](@magnetikonline) and [Virgil](@virgilwashere) would strongly recommend **against**.

Unless your Nginx server is only receiving a few concurrent requests at any one time, you risk exhausting available system memory.

## Updated config snippet

```nginx
    # Setting Nginx FastCGI response buffer sizes
    # http://bit.ly/nginx_fastcgi_buffers

    location ~ \.php$ {
        include /etc/nginx/snippets/fastcgi-php.conf;
        fastcgi_pass                 unix:/var/run/php/php7.0-fpm.sock;

        fastcgi_buffers              128 4k;  # Modified count at default size.
    #   Do NOT change buffer_size. See Gist.  # Current $fastcgi_buffers directive ..
    #   fastcgi_buffer_size          4k;      # ... sets this to 512k
        fastcgi_busy_buffers_size    8k;      # default=2 x buffers
        fastcgi_max_temp_file_size   1024m;   # written in **$fastcgi_temp_file_write_size** chunks
        fastcgi_temp_file_write_size 32k;     # default=2 x buffers

    #   TODO: New directives to research
    #   fastcgi_read_timeout         600;
    #   fastcgi_send_timeout         600;

    #   Not required permanently. Output just FastCGI requests to it's own Nginx log file.
    #   access_log /var/log/nginx/phpfpm-access.log;
}
```
