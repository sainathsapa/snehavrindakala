# Application Load Balancer for Medusa backend
resource "aws_lb" "backend" {
  name               = "${var.environment}-snehavrinda-backend-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.backend.id]
  subnets            = aws_subnet.public[*].id
  enable_deletion_protection = var.enable_deletion_protection

  tags = {
    Name        = "${var.environment}-snehavrinda-backend-alb"
    Environment = var.environment
  }
}

resource "aws_lb_target_group" "backend" {
  name     = "${var.environment}-snehavrinda-backend-tg"
  port     = 9000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path = "/health"
    port = "9000"
    protocol = "HTTP"
    interval = 30
    timeout = 5
    healthy_threshold = 2
    unhealthy_threshold = 3
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_lb_listener" "backend" {
  load_balancer_arn = aws_lb.backend.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    target_group_arn = aws_lb_target_group.backend.arn
    type             = "forward"
  }
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for the ALB"
  type        = string
  default     = ""
}
