import { PartialType } from '@nestjs/swagger';
import { CreateGiftCardBrandDto } from './create-gift-card-brand.dto';

export class UpdateGiftCardBrandDto extends PartialType(
  CreateGiftCardBrandDto,
) {}
