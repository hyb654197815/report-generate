import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto/generate-report.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('generate')
  async generate(@Body() dto: GenerateReportDto, @Res() res: Response) {
    const pdf = await this.reports.generate(dto.templateId, dto.params);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="report-${dto.templateId}.pdf"`,
    );
    res.send(pdf);
  }
}
