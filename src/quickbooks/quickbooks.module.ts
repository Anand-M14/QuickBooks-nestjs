import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuickBooksConnection } from './entities/quickbooks-connection.entity.js';
import { QuickBooksController } from './quickbooks.controller.js';
@Module({
  imports: [TypeOrmModule.forFeature([QuickBooksConnection])],
  controllers:[QuickBooksController]
})
export class QuickBooksModule {
  
}