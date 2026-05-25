# ── Primary Region VPC (eu-west-1) ────────────────────────────────────────────

resource "aws_vpc" "primary" {
  provider             = aws.primary
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = "${local.project}-primary-vpc" }
}

resource "aws_internet_gateway" "primary" {
  provider = aws.primary
  vpc_id   = aws_vpc.primary.id
  tags     = { Name = "${local.project}-primary-igw" }
}

resource "aws_subnet" "primary_public" {
  provider                = aws.primary
  count                   = 3
  vpc_id                  = aws_vpc.primary.id
  cidr_block              = "10.1.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.primary.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.project}-primary-public-${count.index + 1}" }
}

resource "aws_subnet" "primary_private" {
  provider          = aws.primary
  count             = 3
  vpc_id            = aws_vpc.primary.id
  cidr_block        = "10.1.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.primary.names[count.index]
  tags              = { Name = "${local.project}-primary-private-${count.index + 1}" }
}

resource "aws_eip" "primary_nat" {
  provider = aws.primary
  domain   = "vpc"
  tags     = { Name = "${local.project}-primary-nat-eip" }
}

resource "aws_nat_gateway" "primary" {
  provider      = aws.primary
  allocation_id = aws_eip.primary_nat.id
  subnet_id     = aws_subnet.primary_public[0].id
  tags          = { Name = "${local.project}-primary-nat" }
  depends_on    = [aws_internet_gateway.primary]
}

resource "aws_route_table" "primary_public" {
  provider = aws.primary
  vpc_id   = aws_vpc.primary.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.primary.id
  }
  tags = { Name = "${local.project}-primary-public-rt" }
}

resource "aws_route_table" "primary_private" {
  provider = aws.primary
  vpc_id   = aws_vpc.primary.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.primary.id
  }
  tags = { Name = "${local.project}-primary-private-rt" }
}

resource "aws_route_table_association" "primary_public" {
  provider       = aws.primary
  count          = 3
  subnet_id      = aws_subnet.primary_public[count.index].id
  route_table_id = aws_route_table.primary_public.id
}

resource "aws_route_table_association" "primary_private" {
  provider       = aws.primary
  count          = 3
  subnet_id      = aws_subnet.primary_private[count.index].id
  route_table_id = aws_route_table.primary_private.id
}

# ── Secondary Region VPC (eu-central-1) ───────────────────────────────────────

resource "aws_vpc" "secondary" {
  provider             = aws.secondary
  cidr_block           = "10.2.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = { Name = "${local.project}-secondary-vpc" }
}

resource "aws_internet_gateway" "secondary" {
  provider = aws.secondary
  vpc_id   = aws_vpc.secondary.id
  tags     = { Name = "${local.project}-secondary-igw" }
}

resource "aws_subnet" "secondary_public" {
  provider                = aws.secondary
  count                   = 3
  vpc_id                  = aws_vpc.secondary.id
  cidr_block              = "10.2.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.secondary.names[count.index]
  map_public_ip_on_launch = true
  tags                    = { Name = "${local.project}-secondary-public-${count.index + 1}" }
}

resource "aws_subnet" "secondary_private" {
  provider          = aws.secondary
  count             = 3
  vpc_id            = aws_vpc.secondary.id
  cidr_block        = "10.2.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.secondary.names[count.index]
  tags              = { Name = "${local.project}-secondary-private-${count.index + 1}" }
}

resource "aws_eip" "secondary_nat" {
  provider = aws.secondary
  domain   = "vpc"
  tags     = { Name = "${local.project}-secondary-nat-eip" }
}

resource "aws_nat_gateway" "secondary" {
  provider      = aws.secondary
  allocation_id = aws_eip.secondary_nat.id
  subnet_id     = aws_subnet.secondary_public[0].id
  tags          = { Name = "${local.project}-secondary-nat" }
  depends_on    = [aws_internet_gateway.secondary]
}

resource "aws_route_table" "secondary_public" {
  provider = aws.secondary
  vpc_id   = aws_vpc.secondary.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.secondary.id
  }
  tags = { Name = "${local.project}-secondary-public-rt" }
}

resource "aws_route_table" "secondary_private" {
  provider = aws.secondary
  vpc_id   = aws_vpc.secondary.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.secondary.id
  }
  tags = { Name = "${local.project}-secondary-private-rt" }
}

resource "aws_route_table_association" "secondary_public" {
  provider       = aws.secondary
  count          = 3
  subnet_id      = aws_subnet.secondary_public[count.index].id
  route_table_id = aws_route_table.secondary_public.id
}

resource "aws_route_table_association" "secondary_private" {
  provider       = aws.secondary
  count          = 3
  subnet_id      = aws_subnet.secondary_private[count.index].id
  route_table_id = aws_route_table.secondary_private.id
}

# ── Security Groups — Primary ──────────────────────────────────────────────────

resource "aws_security_group" "primary_alb" {
  provider    = aws.primary
  name        = "${local.project}-primary-alb-sg"
  description = "Allow HTTP/HTTPS inbound to primary ALB"
  vpc_id      = aws_vpc.primary.id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.project}-primary-alb-sg" }
}

resource "aws_security_group" "primary_ecs" {
  provider    = aws.primary
  name        = "${local.project}-primary-ecs-sg"
  description = "Allow traffic from primary ALB to ECS tasks"
  vpc_id      = aws_vpc.primary.id

  ingress {
    description     = "API port from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.primary_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.project}-primary-ecs-sg" }
}

resource "aws_security_group" "primary_rds" {
  provider    = aws.primary
  name        = "${local.project}-primary-rds-sg"
  description = "Allow PostgreSQL from primary ECS tasks"
  vpc_id      = aws_vpc.primary.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.primary_ecs.id]
  }

  tags = { Name = "${local.project}-primary-rds-sg" }
}

resource "aws_security_group" "primary_redis" {
  provider    = aws.primary
  name        = "${local.project}-primary-redis-sg"
  description = "Allow Redis from primary ECS tasks"
  vpc_id      = aws_vpc.primary.id

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.primary_ecs.id]
  }

  tags = { Name = "${local.project}-primary-redis-sg" }
}

# ── Security Groups — Secondary ────────────────────────────────────────────────

resource "aws_security_group" "secondary_alb" {
  provider    = aws.secondary
  name        = "${local.project}-secondary-alb-sg"
  description = "Allow HTTP/HTTPS inbound to secondary ALB"
  vpc_id      = aws_vpc.secondary.id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.project}-secondary-alb-sg" }
}

resource "aws_security_group" "secondary_ecs" {
  provider    = aws.secondary
  name        = "${local.project}-secondary-ecs-sg"
  description = "Allow traffic from secondary ALB to ECS tasks"
  vpc_id      = aws_vpc.secondary.id

  ingress {
    description     = "API port from ALB"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.secondary_alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.project}-secondary-ecs-sg" }
}

resource "aws_security_group" "secondary_rds" {
  provider    = aws.secondary
  name        = "${local.project}-secondary-rds-sg"
  description = "Allow PostgreSQL from secondary ECS tasks"
  vpc_id      = aws_vpc.secondary.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.secondary_ecs.id]
  }

  tags = { Name = "${local.project}-secondary-rds-sg" }
}

resource "aws_security_group" "secondary_redis" {
  provider    = aws.secondary
  name        = "${local.project}-secondary-redis-sg"
  description = "Allow Redis from secondary ECS tasks"
  vpc_id      = aws_vpc.secondary.id

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.secondary_ecs.id]
  }

  tags = { Name = "${local.project}-secondary-redis-sg" }
}
