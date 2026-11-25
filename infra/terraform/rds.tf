# RDS PostgreSQL for Medusa backend
resource "aws_db_subnet_group" "medusa" {
  name       = "${var.environment}-snehavrinda-medusa-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
  tags = {
    Environment = var.environment
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.environment}-snehavrinda-rds-sg"
  description = "Allow PostgreSQL access from ECS tasks"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # VPC CIDR only
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-snehavrinda-rds-sg"
    Environment = var.environment
  }
}

resource "aws_db_instance" "medusa" {
  identifier              = "${var.environment}-snehavrinda-medusa-db"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = var.db_instance_class
  allocated_storage       = 100
  max_allocated_storage   = 500
  storage_encrypted       = true
  db_name                 = "medusa"
  username                = "medusa"
  password                = var.db_password
  port                    = 5432
  vpc_security_group_ids  = [aws_security_group.rds.id]
  db_subnet_group_name    = aws_db_subnet_group.medusa.name
  backup_retention_period = 7
  multi_az                = var.enable_multi_az
  deletion_protection     = var.enable_deletion_protection
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  tags = {
    Name        = "${var.environment}-snehavrinda-medusa-db"
    Environment = var.environment
  }
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "enable_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  description = "Enable RDS deletion protection"
  type        = bool
  default     = true
}
