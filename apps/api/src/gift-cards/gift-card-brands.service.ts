import { Injectable, NotFoundException } from '@nestjs/common';
import { GiftCardBrand } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGiftCardBrandDto } from './dto/create-gift-card-brand.dto';
import { UpdateGiftCardBrandDto } from './dto/update-gift-card-brand.dto';

@Injectable()
export class GiftCardBrandsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Seules les marques dont la revente est autorisée sont affichées au catalogue public. */
  listPublic(): Promise<GiftCardBrand[]> {
    return this.prisma.giftCardBrand.findMany({
      where: { resaleAllowed: true },
      orderBy: { name: 'asc' },
    });
  }

  listAllForAdmin(): Promise<GiftCardBrand[]> {
    return this.prisma.giftCardBrand.findMany({ orderBy: { name: 'asc' } });
  }

  async getById(id: string): Promise<GiftCardBrand> {
    const brand = await this.prisma.giftCardBrand.findUnique({ where: { id } });
    if (!brand) {
      throw new NotFoundException('Marque introuvable.');
    }
    return brand;
  }

  create(dto: CreateGiftCardBrandDto): Promise<GiftCardBrand> {
    return this.prisma.giftCardBrand.create({
      data: {
        name: dto.name,
        country: dto.country.toUpperCase(),
        resaleAllowed: dto.resaleAllowed ?? true,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateGiftCardBrandDto,
  ): Promise<GiftCardBrand> {
    await this.getById(id);
    return this.prisma.giftCardBrand.update({
      where: { id },
      data: { ...dto, country: dto.country?.toUpperCase() },
    });
  }
}
