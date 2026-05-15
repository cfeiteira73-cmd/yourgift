variable "aws_region" {
  default = "eu-west-1"
}

variable "environment" {
  default = "production"
}

variable "db_password" {
  sensitive = true
}

variable "domain" {
  default = "yourgift.pt"
}
