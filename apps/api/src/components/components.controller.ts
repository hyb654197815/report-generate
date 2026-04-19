import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ComponentsService } from './components.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

@Controller('components')
export class ComponentsController {
  constructor(private readonly components: ComponentsService) {}

  @Get()
  list() {
    return this.components.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.components.get(id);
  }

  @Post()
  create(@Body() dto: CreateComponentDto) {
    return this.components.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateComponentDto,
  ) {
    return this.components.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.components.remove(id);
  }
}
