# Lambda function to forward captured traffic to staging API
resource "aws_lambda_function" "shadow_forwarder" {
  filename         = "${path.module}/shadow-forwarder.zip"
  function_name    = "yourgift-shadow-forwarder-${var.environment}"
  role             = aws_iam_role.lambda_shadow.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256
  source_code_hash = filebase64sha256("${path.module}/shadow-forwarder.zip")

  environment {
    variables = {
      STAGING_API_URL    = var.staging_api_url
      STAGING_API_KEY    = var.staging_api_key
      FORWARD_PERCENTAGE = "100" # Forward 100% of traffic to staging
      IGNORE_PATHS       = "/health,/metrics"
    }
  }

  tags = { Name = "yourgift-shadow-forwarder" }
}

resource "aws_lambda_event_source_mapping" "kinesis_to_lambda" {
  event_source_arn                   = aws_kinesis_stream.traffic_replay.arn
  function_name                      = aws_lambda_function.shadow_forwarder.arn
  starting_position                  = "LATEST"
  batch_size                         = 100
  maximum_batching_window_in_seconds = 5
  bisect_batch_on_function_error     = true

  destination_config {
    on_failure {
      destination_arn = aws_sqs_queue.shadow_dlq.arn
    }
  }
}

resource "aws_sqs_queue" "shadow_dlq" {
  name                      = "yourgift-shadow-replay-dlq-${var.environment}"
  message_retention_seconds = 86400 # 1 day
  kms_master_key_id         = "alias/aws/sqs"
}

resource "aws_iam_role" "lambda_shadow" {
  name = "yourgift-lambda-shadow-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_shadow_basic" {
  role       = aws_iam_role.lambda_shadow.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_shadow_kinesis" {
  role = aws_iam_role.lambda_shadow.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["kinesis:GetRecords", "kinesis:GetShardIterator", "kinesis:DescribeStream", "kinesis:ListStreams"]
        Resource = aws_kinesis_stream.traffic_replay.arn
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.shadow_dlq.arn
      }
    ]
  })
}
