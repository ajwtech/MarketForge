# Pulumi Cloudflare DNS Record Import Helper

This script helps you import existing Cloudflare DNS records into Pulumi state to avoid resource creation errors.

## Usage

1. Identify the DNS record that already exists (see Pulumi error message).
2. Find the Cloudflare Zone ID and DNS Record ID for the record.
3. Run the import command below, replacing the placeholders with your values.

## Example for root CNAME record:

```
pulumi import cloudflare:index/dnsRecord:DnsRecord root <zoneId>/<recordId>
```

- `root` is the Pulumi resource name (matches your code)
- `<zoneId>` is your Cloudflare Zone ID (e.g., ad64c5018f6aa02d2cd8d5bae9bbd6ad)
- `<recordId>` is the Cloudflare DNS Record ID for the root CNAME

## How to get the DNS Record ID

You can use the Cloudflare API or dashboard to list DNS records for your zone and find the record ID for the root CNAME:

### Using Cloudflare API:

```
curl -X GET "https://api.cloudflare.com/client/v4/zones/<zoneId>/dns_records?type=CNAME&name=@" \
     -H "Authorization: Bearer <API_TOKEN>"
```

Replace `<zoneId>` and `<API_TOKEN>` with your values.

## After Import

Once imported, re-run your Pulumi update. Pulumi will manage the record instead of trying to create it.

---

Repeat for any other DNS records that already exist and cause errors.
