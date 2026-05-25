output "kinesis_stream_arn" {
  description = "ARN of the Kinesis traffic-replay stream"
  value       = aws_kinesis_stream.traffic_replay.arn
}

output "kinesis_stream_name" {
  description = "Name of the Kinesis traffic-replay stream"
  value       = aws_kinesis_stream.traffic_replay.name
}

output "lambda_function_name" {
  description = "Name of the shadow-forwarder Lambda function"
  value       = aws_lambda_function.shadow_forwarder.function_name
}

output "shadow_dlq_url" {
  description = "SQS URL of the shadow-replay dead-letter queue"
  value       = aws_sqs_queue.shadow_dlq.url
}
