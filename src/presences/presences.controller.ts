import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PresencesService } from './presences.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GroupAccessGuard } from '../common/guards/group-access.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreatePresenceDto, UpdatePresenceDto } from './dto/presences.dto';

@Controller('groups/:groupId/presences')
@UseGuards(JwtAuthGuard, GroupAccessGuard)
export class PresencesController {
  constructor(private presencesService: PresencesService) {}

  // GET /api/groups/:groupId/presences?userId=xxx
  @Get()
  findAll(
    @Param('groupId') groupId: string,
    @Query('userId') userId?: string,
  ) {
    return this.presencesService.findAll(groupId, userId);
  }

  // GET /api/groups/:groupId/presences/today
  @Get('today')
  getToday(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
  ) {
    return this.presencesService.getTodayPresence(user.id, groupId);
  }

  // POST /api/groups/:groupId/presences
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreatePresenceDto,
  ) {
    return this.presencesService.create(user.id, groupId, dto);
  }

  // PATCH /api/groups/:groupId/presences/:id
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePresenceDto,
  ) {
    return this.presencesService.update(user.id, id, dto);
  }

  // DELETE /api/groups/:groupId/presences/:id
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.presencesService.remove(user.id, id);
  }
}
