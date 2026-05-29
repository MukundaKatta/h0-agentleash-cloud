# Deploying agentleash cloud (H0 submission runbook)

End to end this is ~10 minutes. You need an AWS account and a Vercel account.

## 1. Create the DynamoDB table

With AWS credentials configured locally (`aws configure` or SSO):

```bash
AWS_REGION=us-east-1 DDB_TABLE=agentleash-cloud bash scripts/create-table.sh
aws dynamodb wait table-exists --table-name agentleash-cloud --region us-east-1
```

## 2. IAM user scoped to just this table

Create an IAM user, attach this policy (replace `ACCOUNT_ID`), then create an access key:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"],
    "Resource": "arn:aws:dynamodb:us-east-1:ACCOUNT_ID:table/agentleash-cloud"
  }]
}
```

## 3. Deploy to Vercel

```bash
npm i -g vercel            # if needed
vercel login
vercel link                # create/link the project
vercel env add AWS_REGION production            # us-east-1
vercel env add DDB_TABLE production             # agentleash-cloud
vercel env add AWS_ACCESS_KEY_ID production      # <key id>
vercel env add AWS_SECRET_ACCESS_KEY production  # <secret>
vercel --prod              # deploy
```

After deploy, open the URL. The store badge should read **`store: dynamodb`**. Click **Seed demo**, then run a check.

## 4. What the H0 submission needs (collect these)

- **Vercel project URL** (the `*.vercel.app` link)
- **Vercel Team ID**: `vercel teams ls`, or Settings -> General -> Team ID
- **Architecture diagram**: in `README.md` (Mermaid). For an image, paste the Mermaid block into <https://mermaid.live> and export PNG.
- **AWS storage proof**: AWS Console -> DynamoDB -> Tables -> `agentleash-cloud` -> Explore items (after seeding you will see `AGENTS` / `AUDIT` items). Screenshot it.
- **Public repo**: <https://github.com/MukundaKatta/h0-agentleash-cloud> (done)

## 5. Demo video (<=3 min) shot list

1. (0-20s) Deployed dashboard, badge reads `store: dynamodb`. One line: "agentleash cloud governs spend and egress for AI agents."
2. (20-60s) Register an agent (cap $5, allow `api.openai.com`). It appears with a budget bar.
3. (60-110s) Simulate checks: one allowed (remaining drops), one denied on domain, one denied on budget. The audit log fills in live.
4. (110-150s) AWS Console showing the DynamoDB table items, proving the backend.
5. (150-180s) Stack line: Next.js on Vercel + DynamoDB, based on the open-source agentleash.

## 6. Submit

`h01.devpost.com` before **Jun 29, 5:00pm PDT**. Fill: description, demo video, AWS database used (DynamoDB), architecture diagram, Vercel project link, Vercel Team ID, AWS storage screenshots.
