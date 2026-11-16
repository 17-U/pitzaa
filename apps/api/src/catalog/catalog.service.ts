import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Service } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Seules les offres qui autorisent le partage sont listées publiquement. */
  listPublic(): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: { allowsSharing: true },
      orderBy: { name: 'asc' },
    });
  }

  listAllForAdmin(): Promise<Service[]> {
    return this.prisma.service.findMany({ orderBy: { name: 'asc' } });
  }

  async getById(id: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Service introuvable.');
    }
    return service;
  }

  create(dto: CreateServiceDto): Promise<Service> {
    return this.prisma.service.create({ data: dto });
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    await this.getById(id);
    return this.prisma.service.update({
      where: { id },
      data: dto as Prisma.ServiceUpdateInput,
    });
  }
}
