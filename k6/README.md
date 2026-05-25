# YourGift OS — k6 Load Tests

Performance and load certification suite for the YourGift OS NestJS API (port 3001).  
Covers B2B procurement, B2C commerce, and BullMQ queue saturation.

---

## Prerequisites

### 1. Install k6

**macOS (Homebrew)**
```bash
brew install k6
```

**Linux (Debian/Ubuntu)**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Windows (Chocolatey)**
```powershell
choco install k6
```

**Windows (Winget)**
```powershell
winget install k6 --source winget
```

**Docker (no install needed)**
```bash
docker pull grafana/k6
```

Verify installation:
```bash
k6 version
# k6 v0.51.0 (...)
```

---

### 2. Start the API

```bash
# From the monorepo root
pnpm run dev

# Or start just the API
cd apps/api && pnpm run start:dev
```

The API must be reachable at `http://localhost:3001/health` before running any script.

---

### 3. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `K6_API_URL` | `http://localhost:3001` | API base URL |
| `K6_AUTH_TOKEN` | `dev-load-test-token` | Bearer token for authenticated routes |
| `K6_STRIPE_WEBHOOK_SECRET` | `whsec_load_test_secret` | Stripe webhook secret (commerce test) |

Set variables inline or export them:

```bash
# Inline
K6_API_URL=https://api-staging.yourgift.pt K6_AUTH_TOKEN=your-token k6 run k6/procurement-load.js

# Exported
export K6_API_URL=https://api-staging.yourgift.pt
export K6_AUTH_TOKEN=your-token
k6 run k6/procurement-load.js
```

---

## Running the Tests

All commands are run from the **monorepo root** (`yourgift-os/`).

### Procurement Load Test

Tests RFQ submission (10k RFQs, 500 peak VUs), approval chains (5k decisions, 250 VUs), and quote evaluation (50k reads, 1000 VUs).

```bash
# Local (default URL + token)
k6 run k6/procurement-load.js

# Staging
K6_API_URL=https://api-staging.yourgift.pt \
K6_AUTH_TOKEN=your-staging-token \
k6 run k6/procurement-load.js

# With JSON output (for CI artifact storage)
k6 run k6/procurement-load.js --out json=k6/results/procurement-$(date +%Y%m%d-%H%M%S).json
```

### Commerce Load Test

Tests flash-sale checkout (2k VUs spike), cart concurrency (500 VUs), payment spikes (200 req/s), and Stripe webhook floods (300 VUs).

```bash
# Local
k6 run k6/commerce-load.js

# Staging
K6_API_URL=https://api-staging.yourgift.pt \
K6_AUTH_TOKEN=your-staging-token \
K6_STRIPE_WEBHOOK_SECRET=whsec_staging_secret \
k6 run k6/commerce-load.js

# With output
k6 run k6/commerce-load.js --out json=k6/results/commerce-$(date +%Y%m%d-%H%M%S).json
```

### Queue Stress Test

Tests BullMQ saturation (100k enqueues, 8 queues), retry storm (10k failures), and DLQ replay (5k entries).  
Requires an admin-level auth token.

```bash
# Local (must use admin token)
K6_AUTH_TOKEN=your-admin-token k6 run k6/queue-stress.js

# Staging
K6_API_URL=https://api-staging.yourgift.pt \
K6_AUTH_TOKEN=your-admin-token \
k6 run k6/queue-stress.js

# With output
k6 run k6/queue-stress.js --out json=k6/results/queue-$(date +%Y%m%d-%H%M%S).json
```

### Run All Tests Sequentially

```bash
#!/usr/bin/env bash
set -euo pipefail

export K6_API_URL="${K6_API_URL:-http://localhost:3001}"
export K6_AUTH_TOKEN="${K6_AUTH_TOKEN:-dev-load-test-token}"
RESULTS_DIR="k6/results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "==> Running procurement load test..."
k6 run k6/procurement-load.js --out "json=$RESULTS_DIR/procurement.json"

echo "==> Running commerce load test..."
k6 run k6/commerce-load.js --out "json=$RESULTS_DIR/commerce.json"

echo "==> Running queue stress test..."
K6_AUTH_TOKEN="${K6_ADMIN_TOKEN:-$K6_AUTH_TOKEN}" \
k6 run k6/queue-stress.js --out "json=$RESULTS_DIR/queue.json"

echo "==> All tests complete. Results in: $RESULTS_DIR"
```

---

## Reading the Output

### Standard k6 Output

A passing run looks like this:

```
     ✓ rfq: status is 2xx
     ✓ rfq: has rfqId in response
     ✓ rfq: response time < 500ms

     █ setup

     checks.........................: 99.87% ✓ 148213  ✗ 192
     data_received..................: 2.1 GB  7.0 MB/s
     data_sent......................: 890 MB  2.9 MB/s
     http_req_blocked...............: avg=1.2ms   min=0s     med=3µs     max=2.1s    p(90)=5µs    p(95)=6µs
     http_req_connecting............: avg=1.1ms   min=0s     med=0s      max=2.0s    p(90)=0s     p(95)=0s
   ✓ http_req_duration..............: avg=78ms    min=2ms    med=54ms    max=890ms   p(90)=187ms  p(95)=241ms
       { expected_response:true }...: avg=76ms    min=2ms    med=52ms    max=887ms   p(90)=183ms  p(95)=238ms
   ✓ http_req_failed................: 0.31%  ✓ 459     ✗ 148946
     http_req_receiving.............: avg=88µs    min=0s     med=44µs    max=98ms    p(90)=170µs  p(95)=250µs
     http_req_sending...............: avg=39µs    min=3µs    med=20µs    max=54ms    p(90)=71µs   p(95)=92µs
     http_req_tls_handshaking.......: avg=0s      min=0s     med=0s      max=0s      p(90)=0s     p(95)=0s
     http_req_waiting...............: avg=78ms    min=2ms    med=54ms    max=890ms   p(90)=187ms  p(95)=240ms
     http_reqs......................: 149405 497.9/s
     iteration_duration.............: avg=412ms   min=3ms    med=250ms   max=3.5s    p(90)=911ms  p(95)=1.3s
     iterations.....................: 72318  240.9/s
   ✓ rfq_duration...................: avg=298ms   min=12ms   med=187ms   max=1.2s    p(90)=498ms  p(95)=498ms
     vus............................: 0      min=0       max=1000
     vus_max........................: 1000   min=1000    max=1000
```

**Key columns:**
- `✓` = threshold passed, `✗` = threshold failed
- `p(95)` / `p(99)` = 95th / 99th percentile latency
- `http_req_failed` = fraction of requests returning 4xx/5xx

### Threshold Failures

If any threshold fails, k6 exits with code `99`:

```
ERRO[0300] some thresholds have failed
```

Check the `✗` lines for which SLO was breached, then correlate with the scenario tag in the output.

### JSON Results

Parse the JSON output with jq or import it into Grafana:

```bash
# Summarise p95 latency by scenario tag
jq -r 'select(.type=="Point" and .metric=="http_req_duration") | [.data.tags.scenario, .data.value] | @csv' \
  k6/results/procurement.json | sort | uniq -c

# Count errors per endpoint
jq -r 'select(.type=="Point" and .metric=="http_req_failed" and .data.value==1) | .data.tags.name' \
  k6/results/commerce.json | sort | uniq -c | sort -rn
```

---

## CI Integration

### GitHub Actions

Add to `.github/workflows/load-test.yml`:

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *'   # nightly at 02:00 UTC
  workflow_dispatch:
    inputs:
      target_url:
        description: 'API URL to test'
        required: false
        default: 'https://api-staging.yourgift.pt'

jobs:
  load-test:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo gpg --no-default-keyring \
            --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 \
            --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
            | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install k6

      - name: Run Procurement Load Test
        env:
          K6_API_URL: ${{ inputs.target_url || 'https://api-staging.yourgift.pt' }}
          K6_AUTH_TOKEN: ${{ secrets.LOAD_TEST_TOKEN }}
        run: k6 run k6/procurement-load.js --out json=procurement-results.json

      - name: Run Commerce Load Test
        env:
          K6_API_URL: ${{ inputs.target_url || 'https://api-staging.yourgift.pt' }}
          K6_AUTH_TOKEN: ${{ secrets.LOAD_TEST_TOKEN }}
          K6_STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET_STAGING }}
        run: k6 run k6/commerce-load.js --out json=commerce-results.json

      - name: Run Queue Stress Test
        env:
          K6_API_URL: ${{ inputs.target_url || 'https://api-staging.yourgift.pt' }}
          K6_AUTH_TOKEN: ${{ secrets.LOAD_TEST_ADMIN_TOKEN }}
        run: k6 run k6/queue-stress.js --out json=queue-results.json

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-results-${{ github.run_number }}
          path: '*-results.json'
          retention-days: 90
```

**Required secrets:**
- `LOAD_TEST_TOKEN` — API bearer token with standard user permissions
- `LOAD_TEST_ADMIN_TOKEN` — API bearer token with admin permissions (queue endpoints)
- `STRIPE_WEBHOOK_SECRET_STAGING` — Stripe test webhook secret

### Grafana Cloud / k6 Cloud

Stream results to Grafana k6 Cloud for live dashboards:

```bash
K6_CLOUD_TOKEN=your-cloud-token \
K6_API_URL=https://api-staging.yourgift.pt \
k6 run --out cloud k6/procurement-load.js
```

---

## File Structure

```
k6/
├── lib/
│   └── config.js                 # Shared config, helpers, payload factories
├── procurement-load.js           # B2B RFQ, approvals, quote evaluation
├── commerce-load.js              # B2C cart, checkout, payments, webhooks
├── queue-stress.js               # BullMQ saturation, retry storm, DLQ replay
├── LOAD_CERTIFICATION_REPORT.md  # SLO verification report
└── README.md                     # This file
```

---

## SLO Reference

| Metric | SLO |
|--------|-----|
| HTTP p95 latency (all) | < 300 ms |
| HTTP p99 latency (all) | < 800 ms |
| HTTP error rate | < 1 % |
| RFQ duration p95 | < 500 ms |
| Checkout success rate | > 99 % |
| Payment duration p95 | < 500 ms |
| BullMQ queue lag p95 | < 5,000 ms |
| DLQ size (total test) | < 1,000 entries |
| Worker throughput | > 95 % |
| Time to Interactive (web) | < 2,500 ms |

---

## Troubleshooting

**`dial tcp connection refused`**  
The API is not running. Start it with `pnpm run dev` and verify `http://localhost:3001/health` returns 200.

**`UNAUTHORIZED` on queue tests**  
The `K6_AUTH_TOKEN` does not have admin privileges. Use a token with the `ADMIN` role for `k6/queue-stress.js`.

**k6 exits with code 99**  
One or more thresholds failed. Read the `✗` lines in the output to identify which SLO was breached. Check API logs for 5xx errors or slow Prisma queries.

**Very high `http_req_blocked` times**  
k6 is running out of OS file descriptors. Increase the limit: `ulimit -n 65535` (Linux/macOS).

**Stripe webhook returns 400 (signature mismatch)**  
Expected in load tests without a live Stripe CLI session. The webhook stress test tolerates 400 responses. For end-to-end webhook testing, use `stripe listen --forward-to localhost:3001/api/payments/stripe/webhook` with a real Stripe CLI.
