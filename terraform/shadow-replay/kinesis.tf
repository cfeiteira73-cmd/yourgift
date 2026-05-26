# Kinesis stream for production traffic capture
resource "aws_kinesis_stream" "traffic_replay" {
  name             = "yourgift-traffic-replay-${var.environment}"
  shard_count      = 2
  retention_period = 24 # hours

  stream_mode_details {
    stream_mode = "PROVISIONED"
  }

  encryption_type = "KMS"
  kms_key_id      = "alias/aws/kinesis"

  tags = { Name = "yourgift-traffic-replay-${var.environment}" }
}

# IAM role for API ECS tasks to write to Kinesis
resource "aws_iam_role" "kinesis_producer" {
  name = "yourgift-kinesis-producer-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "kinesis_producer" {
  role = aws_iam_role.kinesis_producer.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kinesis:PutRecord", "kinesis:PutRecords", "kinesis:DescribeStream"]
      Resource = aws_kinesis_stream.traffic_replay.arn
    }]
  })
}
