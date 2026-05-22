import { Controller, Get, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('stats')
  getStats() {
    return this.jobsService.getStats();
  }

  @Get('recent')
  getRecent() {
    return this.jobsService.getRecentJobs();
  }
}
