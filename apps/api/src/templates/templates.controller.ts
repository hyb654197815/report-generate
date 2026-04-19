import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { RenderHtmlDto } from './dto/render-html.dto';
import { SaveElementsDto } from './dto/save-elements.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(':id/background-file')
  async backgroundFile(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const buf = await this.templates.getBackgroundPdfBuffer(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buf);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.templates.get(id);
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto.name, dto.type);
  }

  @Patch(':id')
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string },
  ) {
    return this.templates.updateMeta(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.templates.remove(id);
  }

  @Post(':id/background')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadBackground(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    const mime = file.mimetype;
    if (mime === 'application/pdf') {
      return this.templates.uploadBackgroundPdf(id, file);
    }
    if (
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/msword'
    ) {
      if (mime === 'application/msword') {
        throw new BadRequestException('Only .docx is supported for Word import');
      }
      return this.templates.uploadBackgroundDocx(id, file);
    }
    throw new BadRequestException(`Unsupported mimetype: ${mime}`);
  }

  @Get(':id/draft-html')
  async draftHtml(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const html = await this.templates.getDraftHtml(id);
    res.type('html').send(html);
  }

  @Post(':id/render-background')
  renderBackground(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenderHtmlDto,
  ) {
    return this.templates.renderBackgroundFromHtml(id, dto.html);
  }

  @Put(':id/elements')
  saveElements(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveElementsDto,
  ) {
    return this.templates.saveElements(id, dto.elements);
  }
}
