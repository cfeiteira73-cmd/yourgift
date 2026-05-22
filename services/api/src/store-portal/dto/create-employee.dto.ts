import { IsBoolean, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateEmployeeDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  allowance?: number;
}

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  allowance?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
