# Secrets Manager for sensitive configuration
resource "aws_secretsmanager_secret" "razorpay_webhook_secret" {
  name        = "${var.environment}/snehavrinda/razorpay/webhook_secret"
  description = "Razorpay webhook secret"
  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "razorpay_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.razorpay_webhook_secret.id
  secret_string = var.razorpay_webhook_secret
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name        = "${var.environment}/snehavrinda/jwt_secret"
  description = "Medusa JWT secret"
  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

resource "aws_secretsmanager_secret" "cookie_secret" {
  name        = "${var.environment}/snehavrinda/cookie_secret"
  description = "Medusa cookie secret"
  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "cookie_secret" {
  secret_id     = aws_secretsmanager_secret.cookie_secret.id
  secret_string = var.cookie_secret
}

resource "aws_secretsmanager_secret" "sanity_api_token" {
  name        = "${var.environment}/snehavrinda/sanity_api_token"
  description = "Sanity API token"
  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "sanity_api_token" {
  secret_id     = aws_secretsmanager_secret.sanity_api_token.id
  secret_string = var.sanity_api_token
}

variable "razorpay_webhook_secret" {
  description = "Razorpay webhook secret"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "Medusa JWT secret"
  type        = string
  sensitive   = true
}

variable "cookie_secret" {
  description = "Medusa cookie secret"
  type        = string
  sensitive   = true
}

variable "sanity_api_token" {
  description = "Sanity API token"
  type        = string
  sensitive   = true
}
