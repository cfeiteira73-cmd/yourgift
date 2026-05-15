resource "aws_db_subnet_group" "yourgift" {
  name       = "yourgift-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier        = "yourgift-postgres-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = "db.t3.medium"
  allocated_storage = 50
  storage_encrypted = true

  db_name  = "yourgift"
  username = "yourgift_admin"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.yourgift.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "yourgift-final-${var.environment}"

  performance_insights_enabled = true

  tags = {
    Environment = var.environment
    Project     = "yourgift-os"
  }
}
