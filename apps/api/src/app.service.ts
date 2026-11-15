import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo(): { name: string; version: string } {
    return { name: 'Pitzaa API', version: '0.0.1' };
  }
}
