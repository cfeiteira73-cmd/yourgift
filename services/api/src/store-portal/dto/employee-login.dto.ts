import { IsEmail, IsNotEmpty } from 'class-validator';

export class EmployeeLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
