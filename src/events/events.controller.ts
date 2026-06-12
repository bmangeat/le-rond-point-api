import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GroupAccessGuard } from '../common/guards/group-access.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CurrentMembership } from '../common/decorators/current-membership.decorator';
import { GroupMembership } from '@prisma/client';
import {
  CreateEventDto,
  UpdateEventDto,
  CancelEventDto,
  UpdateRsvpDto,
  CreateNeedDto,
  CreateExpenseDto,
  CreateCommentDto,
  ReportCommentDto,
} from './dto/events.dto';

@Controller('groups/:groupId/events')
@UseGuards(JwtAuthGuard, GroupAccessGuard)
export class EventsController {
  constructor(private eventsService: EventsService) {}

  // GET /api/groups/:groupId/events
  @Get()
  findAll(@Param('groupId') groupId: string) {
    return this.eventsService.findAll(groupId);
  }

  // GET /api/groups/:groupId/events/:id
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.findOne(id, user.id);
  }

  // POST /api/groups/:groupId/events
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(user.id, groupId, dto);
  }

  // PATCH /api/groups/:groupId/events/:id
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: GroupMembership,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.update(user.id, id, dto, membership.role === 'ADMIN');
  }

  // DELETE /api/groups/:groupId/events/:id (annulation)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: GroupMembership,
    @Param('id') id: string,
    @Body() dto: CancelEventDto,
  ) {
    return this.eventsService.cancel(user.id, id, dto, membership.role === 'ADMIN');
  }

  // PATCH /api/groups/:groupId/events/:id/rsvp
  @Patch(':id/rsvp')
  updateRsvp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() dto: UpdateRsvpDto,
  ) {
    return this.eventsService.updateRsvp(user.id, eventId, dto.status);
  }

  // GET /api/groups/:groupId/events/:id/balances
  @Get(':id/balances')
  getBalances(@Param('id') id: string) {
    return this.eventsService.getBalances(id);
  }

  // --- Besoins ---

  @Post(':id/needs')
  createNeed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() dto: CreateNeedDto,
  ) {
    return this.eventsService.createNeed(user.id, eventId, dto);
  }

  @Delete(':id/needs/:needId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteNeed(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Param('needId') needId: string,
  ) {
    return this.eventsService.deleteNeed(user.id, eventId, needId);
  }

  @Patch(':id/needs/:needId/claim')
  claimNeed(@CurrentUser() user: AuthenticatedUser, @Param('needId') needId: string) {
    return this.eventsService.claimNeed(user.id, needId);
  }

  @Delete(':id/needs/:needId/claim')
  @HttpCode(HttpStatus.NO_CONTENT)
  unclaimNeed(@CurrentUser() user: AuthenticatedUser, @Param('needId') needId: string) {
    return this.eventsService.unclaimNeed(user.id, needId);
  }

  // --- Dépenses ---

  @Post(':id/expenses')
  createExpense(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.eventsService.createExpense(user.id, eventId, dto);
  }

  @Delete(':id/expenses/:expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteExpense(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: GroupMembership,
    @Param('expenseId') expenseId: string,
  ) {
    return this.eventsService.deleteExpense(user.id, expenseId, membership.role === 'ADMIN');
  }

  // --- Commentaires ---

  @Post(':id/comments')
  createComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.eventsService.createComment(user.id, eventId, dto);
  }

  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteComment(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentMembership() membership: GroupMembership,
    @Param('commentId') commentId: string,
  ) {
    return this.eventsService.deleteComment(user.id, commentId, membership.role === 'ADMIN');
  }

  @Post(':id/comments/:commentId/report')
  reportComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('commentId') commentId: string,
    @Body() dto: ReportCommentDto,
  ) {
    return this.eventsService.reportComment(user.id, commentId, dto);
  }
}
