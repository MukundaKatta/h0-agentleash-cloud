#!/usr/bin/env bash
# Create the single DynamoDB table that agentleash cloud uses (pay-per-request, no GSIs).
set -euo pipefail

TABLE="${DDB_TABLE:-agentleash-cloud}"
REGION="${AWS_REGION:-us-east-1}"

echo "Creating DynamoDB table '$TABLE' in $REGION ..."
aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

echo "Submitted. Wait until ACTIVE with:"
echo "  aws dynamodb wait table-exists --table-name $TABLE --region $REGION"
