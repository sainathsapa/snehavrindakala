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

resource "aws_iam_role_policy_attachment" "ecs_task_secrets" {
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
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.cookie_secret.arn,
          aws_secretsmanager_secret.sanity_api_token.arn,
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
