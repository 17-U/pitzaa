import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Vérifie que l'API répond" })
  check(): HealthStatus {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
