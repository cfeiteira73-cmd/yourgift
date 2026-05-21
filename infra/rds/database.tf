resource "aws_db_subnet_group" "yourgift" {
  name       = "yourgift-db-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "rds" {
  name        = "yourgift-rds-sg-${var.environment}"
  description = "Allow PostgreSQL from ECS tasks only"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from within VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "yourgift-rds-sg"
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

resource "aws_db_instance" "postgres" {
  identifier        = "yourgift-postgres-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = var.db_instance_class
  allocated_storage = 50
  storage_encrypted = true

  db_name  = var.db_name
  username = "yourgift_admin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.yourgift.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period   = 7
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "yourgift-final-${var.environment}"

  performance_insights_enabled = true

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}

# ── Variables ─────────────────────────────────────────────────────────────────
variable "environment" {
  type    = string
  default = "production"
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "db_name" {
  type    = string
  default = "yourgift"
}

variable "private_subnet_ids" {
  description = "Private subnet IDs from networking module"
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID from networking module"
  type        = string
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "db_endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true
}

output "db_name" {
  value = aws_db_instance.postgres.db_name
}
