import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComponentDto } from './dto/create-component.dto';
import { UpdateComponentDto } from './dto/update-component.dto';

@Injectable()
export class ComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.sysComponent.findMany({ orderBy: { id: 'desc' } });
  }

  async create(dto: CreateComponentDto) {
    return this.prisma.sysComponent.create({ data: dto });
  }

  async get(id: number) {
    const c = await this.prisma.sysComponent.findUnique({ where: { id } });
    if (!c) {
      throw new NotFoundException('Component not found');
    }
    return c;
  }

  async update(id: number, dto: UpdateComponentDto) {
    await this.get(id);
    const data = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as UpdateComponentDto;
    if (Object.keys(data).length === 0) {
      return this.prisma.sysComponent.findUniqueOrThrow({ where: { id } });
    }
    return this.prisma.sysComponent.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.get(id);
    await this.prisma.sysComponent.delete({ where: { id } });
  }
}
