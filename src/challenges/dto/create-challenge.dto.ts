import { IsString, IsNotEmpty, IsNumber, IsArray, Min, Max, IsOptional } from 'class-validator';

export class CreateChallengeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(1)
  @Max(365)
  duration: number;

  @IsArray()
  tasks: string[];

  @IsString()
  @IsNotEmpty()
  penalty: string;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;

  @IsOptional()
  target?: number;

  @IsOptional()
  type?: string;
}