# IAM roles for ECS tasks
resource "aws_iam_role" "ecs_execution" {
  name = "${var.environment}-snehavrinda-ecs-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  tags = {
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "${var.environment}-snehavrinda-ecs-task-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
  tags = {
    Environment = var.environment
  }
}

# ECS resolves task-definition `secrets` at container start using the EXECUTION
# role, not the task role. This policy used to be attached to ecs_task only, so
# every `secrets` entry would have failed to resolve and the container would have
# started without its credentials. Both roles are granted: the execution role so
# the values can be injected, and the task role so the app can read them at
# runtime if it ever needs to.
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  role = aws_iam_role.ecs_execution.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.razorpay_webhook_secret.arn,
          aws_secretsmanager_secret.razorpay_key_secret.arn,
          aws_secretsmanager_secret.shiprocket_api_token.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.cookie_secret.arn,
          aws_secretsmanager_secret.sanity_api_token.arn,
          aws_secretsmanager_secret.database_url.arn,
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_task_secrets" {
  role = aws_iam_role.ecs_task.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.razorpay_webhook_secret.arn,
          aws_secretsmanager_secret.razorpay_key_secret.arn,
          aws_secretsmanager_secret.shiprocket_api_token.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.cookie_secret.arn,
          aws_secretsmanager_secret.sanity_api_token.arn,
          aws_secretsmanager_secret.database_url.arn,
        ]
      }
    ]
  })
}

# CloudWatch log group
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/snehavrinda/backend"
  retention_in_days = 30
  tags = {
    Environment = var.environment
  }
}
