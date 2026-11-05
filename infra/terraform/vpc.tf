# VPC with public and private subnets across two AZs
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags = {
    Name        = "${var.environment}-snehavrinda-vpc"
    Environment = var.environment
  }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = {
    Name        = "${var.environment}-snehavrinda-public-${count.index + 1}"
    Environment = var.environment
    Tier        = "public"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 3}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = false
  tags = {
    Name        = "${var.environment}-snehavrinda-private-${count.index + 1}"
    Environment = var.environment
    Tier        = "private"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name        = "${var.environment}-snehavrinda-igw"
    Environment = var.environment
  }
}

resource "aws_nat_gateway" "main" {
  count             = 1
  allocation_id     = aws_eip.nat[count.index].id
  subnet_id         = aws_subnet.public[0].id
  connectivity_type = "public"
  tags = {
    Name        = "${var.environment}-snehavrinda-nat"
    Environment = var.environment
  }
}

resource "aws_eip" "nat" {
  count = 1
  domain = "vpc"
  tags = {
    Name        = "${var.environment}-snehavrinda-nat-eip"
    Environment = var.environment
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
  tags = {
    Name        = "${var.environment}-snehavrinda-public-rt"
    Environment = var.environment
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[0].id
  }
  tags = {
    Name        = "${var.environment}-snehavrinda-private-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

data "aws_availability_zones" "available" {
  state = "available"
}
