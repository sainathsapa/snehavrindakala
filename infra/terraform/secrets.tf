# Secrets Manager for sensitive configuration.
#
# WHY EVERY CREDENTIAL HERE IS A `secrets` ENTRY, NOT AN `environment` ENTRY
#
# An ECS task definition stores `environment` variables in plaintext twice: in
# the task definition revision itself (readable by anyone with
# ecs:DescribeTaskDefinition) and in the Terraform state and plan output. Only
# `secrets` entries resolve at task start from Secrets Manager, so the value is
# never part of the task definition document, `terraform plan`, or a state file.
#
# The backend task definition used to pass RAZORPAY_KEY_SECRET and
# SHIPROCKET_API_TOKEN through `environment`, and DATABASE_URL as the bare RDS
# endpoint (host:port — not even a usable connection string). All three are now
# Secrets Manager references.
#
# Nothing here is applied by CI. Rotation is a human step: see
# docs/release/CREDENTIAL_ROTATION_REGISTER.md.

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

resource "aws_secretsmanager_secret" "razorpay_key_secret" {
  name        = "${var.environment}/snehavrinda/razorpay/key_secret"
  description = "Razorpay API key secret (the secret half of the key pair)"
  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "razorpay_key_secret" {
  secret_id     = aws_secretsmanager_secret.razorpay_key_secret.id
  secret_string = var.razorpay_key_secret
}

resource "aws_secretsmanager_secret" "shiprocket_api_token" {
  name        = "${var.environment}/snehavrinda/shiprocket/api_token"
  description = "Shiprocket API token"
  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "shiprocket_api_token" {
  secret_id     = aws_secretsmanager_secret.shiprocket_api_token.id
  secret_string = var.shiprocket_api_token
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

# The backend needs a full connection URL, not the RDS endpoint. Composing it
# here keeps the database password out of the task definition, and out of any
# code path that logged the old host:port value as if it were a URL.
resource "aws_secretsmanager_secret" "database_url" {
  name        = "${var.environment}/snehavrinda/database_url"
  description = "PostgreSQL connection URL for the Medusa backend"
  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "postgresql://%s:%s@%s/%s?sslmode=require",
    aws_db_instance.medusa.username,
    var.db_password,
    aws_db_instance.medusa.endpoint,
    aws_db_instance.medusa.db_name,
  )
}

variable "razorpay_webhook_secret" {
  description = "Razorpay webhook secret"
  type        = string
  sensitive   = true
}

variable "razorpay_key_secret" {
  description = "Razorpay API key secret"
  type        = string
  sensitive   = true
}

variable "shiprocket_api_token" {
  description = "Shiprocket API token"
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
