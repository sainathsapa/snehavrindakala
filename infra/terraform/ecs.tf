# ECS cluster and Fargate services for Medusa backend
resource "aws_ecs_cluster" "backend" {
  name = "${var.environment}-snehavrinda-backend"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  tags = {
    Environment = var.environment
  }
}

resource "aws_security_group" "backend" {
  name        = "${var.environment}-snehavrinda-backend-sg"
  description = "Allow HTTPS access to Medusa backend"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 9000
    to_port     = 9000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # ALB only
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-snehavrinda-backend-sg"
    Environment = var.environment
  }
}

resource "aws_ecs_task_definition" "backend_api" {
  family                   = "${var.environment}-snehavrinda-backend-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ecs_cpu
  memory                   = var.ecs_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([
    {
      name      = "medusa-backend"
      image     = "${var.backend_image}"
      portMappings = [
        {
          containerPort = 9000
          hostPort      = 9000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "DATABASE_URL", value = aws_db_instance.medusa.endpoint },
        { name = "REDIS_URL", value = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379" },
        { name = "MEDUSA_BACKEND_URL", value = var.backend_url },
        { name = "RAZORPAY_KEY_ID", value = var.razorpay_key_id },
        { name = "RAZORPAY_KEY_SECRET", value = var.razorpay_key_secret },
        { name = "SHIPROCKET_API_TOKEN", value = var.shiprocket_api_token },
        { name = "AWS_REGION", value = var.aws_region },
      ]
      secrets = [
        { name = "RAZORPAY_WEBHOOK_SECRET", valueArn = aws_secretsmanager_secret_version.razorpay_webhook_secret.arn },
        { name = "JWT_SECRET", valueArn = aws_secretsmanager_secret_version.jwt_secret.arn },
        { name = "COOKIE_SECRET", valueArn = aws_secretsmanager_secret_version.cookie_secret.arn },
        { name = "SANITY_API_TOKEN", valueArn = aws_secretsmanager_secret_version.sanity_api_token.arn },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group" = aws_cloudwatch_log_group.backend.name
          "awslogs-region" = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
      healthCheck = {
        command = ["CMD-SHELL", "curl -f http://localhost:9000/health || exit 1"]
        interval = 30
        timeout = 5
        retries = 3
        startPeriod = 30
      }
    }
  ])
  tags = {
    Environment = var.environment
  }
}

resource "aws_ecs_service" "backend_api" {
  name            = "${var.environment}-snehavrinda-backend-api"
  cluster         = aws_ecs_cluster.backend.id
  task_definition = aws_ecs_task_definition.backend_api.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancers {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "medusa-backend"
    container_port   = 9000
  }

  depends_on = [aws_ecs_service_deployment.backend_api]
  tags = {
    Environment = var.environment
  }
}

resource "aws_ecs_service_deployment" "backend_api" {
  service = aws_ecs_service.backend_api.id
}

variable "backend_image" {
  description = "Docker image for Medusa backend"
  type        = string
}

variable "backend_url" {
  description = "Medusa backend URL"
  type        = string
}

variable "backend_desired_count" {
  description = "Number of backend tasks"
  type        = number
  default     = 2
}

variable "razorpay_key_id" {
  description = "Razorpay key ID"
  type        = string
}

variable "razorpay_key_secret" {
  description = "Razorpay key secret"
  type        = string
  sensitive   = true
}

variable "shiprocket_api_token" {
  description = "Shiprocket API token"
  type        = string
  sensitive   = true
}
